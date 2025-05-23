import * as React from "react";
import { useTranslations } from "use-intl";
import { Layout } from "components/Layout";
import { getSessionUser } from "lib/auth";
import { getTranslations } from "lib/getTranslation";
import { getObjLength, isEmpty, makeUnitName, requestAll } from "lib/utils";
import { GetServerSideProps } from "next";
import { AssignedUnit } from "@snailycad/types";
import { Table, useAsyncTable, useTableState } from "components/shared/Table";
import { useGenerateCallsign } from "hooks/useGenerateCallsign";
import { Full911Call } from "state/dispatch/dispatch-state";
import { Loader, Button, TextField, FullDate } from "@snailycad/ui";
import { useModal } from "state/modalState";
import { ModalIds } from "types/modal-ids";
import { LinkCallToIncidentModal } from "components/leo/call-history/link-call-to-citizen-modal";
import useFetch from "lib/useFetch";
import { Title } from "components/shared/Title";
import { AlertModal } from "components/modal/AlertModal";
import { Manage911CallModal } from "components/dispatch/active-calls/modals/manage-911-call-modal";
import { isUnitCombined } from "@snailycad/utils";
import { usePermission, Permissions } from "hooks/usePermission";
import { DeletePurge911CallsData, Get911CallsData, GetIncidentsData } from "@snailycad/types/api";
import { useTemporaryItem } from "hooks/shared/useTemporaryItem";
import { getSelectedTableRows } from "hooks/shared/table/use-table-state";
import { CallDescription } from "components/dispatch/active-calls/CallDescription";
import { useCall911State } from "state/dispatch/call-911-state";

interface Props {
  data: Get911CallsData;
  incidents: GetIncidentsData<"leo">["incidents"];
}

export default function CallHistory({ data, incidents }: Props) {
  const [search, setSearch] = React.useState("");

  const { hasPermissions } = usePermission();
  const hasManagePermissions = hasPermissions([Permissions.ManageCallHistory]);
  const setCurrentlySelectedCall = useCall911State((state) => state.setCurrentlySelectedCall);

  const asyncTable = useAsyncTable({
    search,
    fetchOptions: {
      path: "/911-calls?includeEnded=true&take=35",
      onResponse: (json: Get911CallsData) => ({ data: json.calls, totalCount: json.totalCount }),
    },
    totalCount: data.totalCount,
    initialData: data.calls,
  });

  const tableState = useTableState({
    pagination: asyncTable.pagination,
  });
  const { state, execute } = useFetch();
  const [tempCall, callState] = useTemporaryItem(asyncTable.items);

  const modalState = useModal();
  const t = useTranslations("Calls");
  const leo = useTranslations("Leo");
  const common = useTranslations("Common");
  const { generateCallsign } = useGenerateCallsign();

  function handleLinkClick(call: Full911Call) {
    callState.setTempId(call.id);
    modalState.openModal(ModalIds.LinkCallToIncident);
    setCurrentlySelectedCall(call);
  }

  function handleViewClick(call: Full911Call) {
    callState.setTempId(call.id);
    modalState.openModal(ModalIds.Manage911Call);
    setCurrentlySelectedCall(call);
  }

  async function handlePurge() {
    const selectedRows = getSelectedTableRows(asyncTable.items, tableState.rowSelection);
    if (selectedRows.length <= 0) return;

    const { json } = await execute<DeletePurge911CallsData>({
      path: "/911-calls/purge",
      method: "DELETE",
      data: { ids: selectedRows },
    });

    if (json) {
      asyncTable.remove(...selectedRows);
      modalState.closeModal(ModalIds.AlertPurgeCalls);
    }
  }

  function makeUnit(unit: AssignedUnit) {
    if (!unit.unit) return "UNKNOWN";

    return isUnitCombined(unit.unit)
      ? generateCallsign(unit.unit, "pairedUnitTemplate")
      : `${generateCallsign(unit.unit)} ${makeUnitName(unit.unit)}`;
  }

  return (
    <Layout
      permissions={{
        permissions: [Permissions.ViewCallHistory, Permissions.ManageCallHistory],
      }}
      className="dark:text-white"
    >
      <Title>{leo("callHistory")}</Title>

      {data.calls.length <= 0 ? (
        <p className="mt-5">{"No calls ended yet."}</p>
      ) : (
        <>
          <div className="mb-2 flex gap-2 items-center">
            <TextField
              onChange={(value) => setSearch(value)}
              value={search}
              label={common("search")}
              className="w-full"
            />
            {hasManagePermissions ? (
              <Button
                onPress={() => modalState.openModal(ModalIds.AlertPurgeCalls)}
                className="flex items-center gap-2 min-w-fit h-10 mt-3.5"
                disabled={state === "loading" || isEmpty(tableState.rowSelection)}
              >
                {state === "loading" ? <Loader /> : null}
                {t("purgeSelected")}
              </Button>
            ) : null}
          </div>

          {search && asyncTable.pagination.totalDataCount !== data.totalCount ? (
            <p className="italic text-base font-semibold">
              {common.rich("showingXResults", {
                amount: asyncTable.pagination.totalDataCount,
              })}
            </p>
          ) : null}

          <Table
            tableState={tableState}
            features={{ rowSelection: hasManagePermissions }}
            data={asyncTable.items.map((call) => {
              const caseNumbers = (call.incidents ?? []).map((i) => `#${i.caseNumber}`).join(", ");

              return {
                id: call.id,
                rowProps: { call },
                caller: call.name,
                location: call.location,
                postal: call.postal,
                description: <CallDescription nonCard data={call} />,
                assignedUnits: call.assignedUnits.map(makeUnit).join(", ") || common("none"),
                caseNumbers: caseNumbers || common("none"),
                createdAt: <FullDate>{call.createdAt}</FullDate>,
                actions: (
                  <>
                    {hasManagePermissions ? (
                      <Button onPress={() => handleLinkClick(call)} size="xs">
                        {leo("linkToIncident")}
                      </Button>
                    ) : null}
                    <Button className="ml-2" onPress={() => handleViewClick(call)} size="xs">
                      {leo("viewCall")}
                    </Button>
                  </>
                ),
              };
            })}
            columns={[
              { header: t("caller"), accessorKey: "caller" },
              { header: t("location"), accessorKey: "location" },
              { header: t("postal"), accessorKey: "postal" },
              { header: common("description"), accessorKey: "description" },
              { header: t("assignedUnits"), accessorKey: "assignedUnits" },
              { header: leo("caseNumbers"), accessorKey: "caseNumbers" },
              { header: common("createdAt"), accessorKey: "createdAt" },
              { header: common("actions"), accessorKey: "actions" },
            ]}
          />
        </>
      )}

      <LinkCallToIncidentModal
        onSave={(call) => {
          asyncTable.update(call.id, call);
        }}
        incidents={incidents}
        call={tempCall}
      />
      <AlertModal
        title={t("purgeSelectedCalls")}
        description={t("alert_purgeSelectedCalls", {
          length: getObjLength(tableState.rowSelection),
        })}
        id={ModalIds.AlertPurgeCalls}
        onDeleteClick={handlePurge}
        deleteText={t("purge")}
      />

      <Manage911CallModal call={tempCall} />
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, locale }) => {
  const user = await getSessionUser(req);
  const [calls, { incidents }] = await requestAll(req, [
    ["/911-calls?includeEnded=true&take=35", { calls: [], totalCount: 0 }],
    ["/incidents", { incidents: [] }],
  ]);

  return {
    props: {
      session: user,
      data: calls,
      incidents,
      messages: {
        ...(await getTranslations(["leo", "calls", "common"], user?.locale ?? locale)),
      },
    },
  };
};
