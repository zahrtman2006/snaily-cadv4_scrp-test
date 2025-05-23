import { ExpungementRequestStatus } from "@snailycad/types";
import { Table, useAsyncTable, useTableState } from "components/shared/Table";
import { usePermission, Permissions } from "hooks/usePermission";
import { useTranslations } from "next-intl";
import { getTitles } from "components/courthouse/expungement-requests/request-expungement-modal";
import { Button, FullDate, Status, TabsContent } from "@snailycad/ui";
import useFetch from "lib/useFetch";
import { GetManageExpungementRequests, PutManageExpungementRequests } from "@snailycad/types/api";
import { useInvalidateQuery } from "hooks/use-invalidate-query";
import { CallDescription } from "components/dispatch/active-calls/CallDescription";

interface Props {
  requests: GetManageExpungementRequests;
}

export function ExpungementRequestsTab({ requests: data }: Props) {
  const t = useTranslations();
  const common = useTranslations("Common");
  const tableState = useTableState();
  const { state, execute } = useFetch();
  const { hasPermissions } = usePermission();
  const hasManagePermissions = hasPermissions([Permissions.ManageExpungementRequests]);
  const { invalidateQuery } = useInvalidateQuery(["admin", "notifications"]);

  const asyncTable = useAsyncTable({
    fetchOptions: {
      onResponse: (data: GetManageExpungementRequests) => ({
        data: data.pendingExpungementRequests,
        totalCount: data.totalCount,
      }),
      path: "/admin/manage/expungement-requests",
    },
    initialData: data.pendingExpungementRequests,
    totalCount: data.totalCount,
  });

  async function handleUpdate(id: string, type: ExpungementRequestStatus) {
    const { json } = await execute<PutManageExpungementRequests>({
      path: `/admin/manage/expungement-requests/${id}`,
      method: "PUT",
      data: { type },
    });

    if (json) {
      asyncTable.remove(id);
      await invalidateQuery();
    }
  }

  return (
    <TabsContent
      tabName={`${t("Management.MANAGE_EXPUNGEMENT_REQUESTS")} ${
        asyncTable.isInitialLoading ? "" : ` (${asyncTable.pagination.totalDataCount})`
      }`}
      value="expungement-requests"
    >
      <h3 className="font-semibold text-xl">{t("Management.MANAGE_EXPUNGEMENT_REQUESTS")}</h3>

      {asyncTable.noItemsAvailable ? (
        <p className="my-2">{t("Courthouse.noPendingRequests")}</p>
      ) : (
        <Table
          tableState={tableState}
          data={asyncTable.items.map((request) => ({
            id: request.id,
            citizen: `${request.citizen.name} ${request.citizen.surname}`,
            description: <CallDescription data={{ description: request.description }} />,
            warrants: request.warrants.map((w) => w.description).join(", ") || common("none"),
            arrestReports:
              request.records
                .filter((v) => v.type === "ARREST_REPORT")
                .map((w) => getTitles(w))
                .join(", ") || common("none"),
            tickets:
              request.records
                .filter((v) => v.type === "TICKET")
                .map((w) => getTitles(w))
                .join(", ") || common("none"),
            status: <Status>{request.status}</Status>,
            createdAt: <FullDate>{request.createdAt}</FullDate>,
            actions: (
              <>
                <Button
                  disabled={state === "loading"}
                  onPress={() => handleUpdate(request.id, ExpungementRequestStatus.ACCEPTED)}
                  variant="success"
                  size="xs"
                >
                  {common("accept")}
                </Button>
                <Button
                  className="ml-2"
                  disabled={state === "loading"}
                  onPress={() => handleUpdate(request.id, ExpungementRequestStatus.DENIED)}
                  variant="danger"
                  size="xs"
                >
                  {common("decline")}
                </Button>
              </>
            ),
          }))}
          columns={[
            { header: t("Leo.citizen"), accessorKey: "citizen" },
            { header: common("description"), accessorKey: "description" },
            { header: t("Leo.warrants"), accessorKey: "warrants" },
            { header: t("Leo.arrestReports"), accessorKey: "arrestReports" },
            { header: t("Leo.tickets"), accessorKey: "tickets" },
            { header: t("Leo.status"), accessorKey: "status" },
            { header: common("createdAt"), accessorKey: "createdAt" },
            hasManagePermissions ? { header: common("actions"), accessorKey: "actions" } : null,
          ]}
        />
      )}
    </TabsContent>
  );
}
