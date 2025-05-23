import { useTranslations } from "use-intl";
import { Loader, Button, TextField, FormRow } from "@snailycad/ui";
import { Modal } from "components/modal/Modal";
import { useModal } from "state/modalState";
import { ModalIds } from "types/modal-ids";
import { Form, Formik } from "formik";
import { FormField } from "components/form/FormField";
import useFetch from "lib/useFetch";

import { Put911CallByIdData } from "@snailycad/types/api";
import { useValues } from "context/ValuesContext";
import { useFeatureEnabled } from "hooks/useFeatureEnabled";
import { Select } from "components/form/Select";
import { CallSignPreview } from "components/leo/CallsignPreview";
import {
  CREATE_TEMPORARY_EMS_FD_DEPUTY_SCHEMA,
  CREATE_TEMPORARY_OFFICER_SCHEMA,
} from "@snailycad/schemas";
import { handleValidate } from "lib/handleValidate";

interface Props {
  onClose?(): void;
}

export function CreateTemporaryUnitModal({ onClose }: Props) {
  const modalState = useModal();
  const common = useTranslations("Common");
  const { state, execute } = useFetch();
  const type = modalState.getPayload(ModalIds.CreateTemporaryUnit) as "ems-fd" | "officer";

  const { DIVISIONS, BADGE_NUMBERS } = useFeatureEnabled();
  const { division, department } = useValues();

  const t = useTranslations();

  function handleClose() {
    onClose?.();
    modalState.closeModal(ModalIds.CreateTemporaryUnit);
  }

  async function onSubmit(values: typeof INITIAL_VALUES) {
    const { json } = await execute<Put911CallByIdData>({
      path: `/temporary-units/${type}`,
      method: "POST",
      data: {
        ...values,
        identifiers: values.identifier.length <= 0 ? [] : values.identifier.split(","),
      },
    });

    if (json.id) {
      handleClose();
    }
  }

  const schema =
    type === "ems-fd" ? CREATE_TEMPORARY_EMS_FD_DEPUTY_SCHEMA : CREATE_TEMPORARY_OFFICER_SCHEMA;
  const validate = handleValidate(schema);
  const INITIAL_VALUES = {
    name: "",
    surname: "",

    department: "",
    division: "",
    divisions: [],
    callsign: "",
    callsign2: "",
    badgeNumberString: "",
    identifier: "",
  };

  return (
    <Modal
      isOpen={modalState.isOpen(ModalIds.CreateTemporaryUnit)}
      onClose={handleClose}
      title={t("Leo.createTemporaryUnit")}
      className="w-[600px]"
    >
      <Formik validate={validate} onSubmit={onSubmit} initialValues={INITIAL_VALUES}>
        {({ handleChange, setFieldValue, values, errors }) => (
          <Form>
            <FormRow>
              <TextField
                errorMessage={errors.name}
                label={t("Citizen.name")}
                name="name"
                onChange={(value) => setFieldValue("name", value)}
                value={values.name}
              />

              <TextField
                errorMessage={errors.surname}
                label={t("Citizen.surname")}
                name="surname"
                onChange={(value) => setFieldValue("surname", value)}
                value={values.surname}
              />
            </FormRow>

            <TextField
              isOptional
              errorMessage={errors.identifier}
              label={t("Leo.identifiers")}
              name="identifier"
              onChange={(value) => setFieldValue("identifier", value)}
              value={values.identifier}
              placeholder="discord:000000000,steam:000000000,license:000000000"
            />
            <p className="-mt-1.5 text-base text-neutral-700 dark:text-gray-400 mb-3">
              {t("Leo.identifiersInfo")}
            </p>

            <FormField label={t("Leo.department")}>
              <Select
                name="department"
                onChange={handleChange}
                value={values.department}
                values={department.values
                  .filter(
                    (v) =>
                      (type === "officer" && v.type === "LEO") ||
                      (type === "ems-fd" && v.type === "EMS_FD"),
                  )
                  .map((v) => ({
                    label: v.value.value,
                    value: v.id,
                  }))}
              />
            </FormField>

            {DIVISIONS ? (
              <FormField
                errorMessage={type === "officer" ? (errors.divisions as string) : errors.division}
                label={t("Leo.division")}
              >
                {type === "officer" ? (
                  <Select
                    isMulti
                    value={values.divisions}
                    name="divisions"
                    onChange={handleChange}
                    values={division.values
                      .filter((v) =>
                        values.department ? v.departmentId === values.department : true,
                      )
                      .map((value) => ({
                        label: value.value.value,
                        value: value.id,
                      }))}
                  />
                ) : (
                  <Select
                    name="division"
                    onChange={handleChange}
                    value={values.division}
                    values={division.values
                      .filter((v) =>
                        values.department ? v.departmentId === values.department : true,
                      )
                      .map((value) => ({
                        label: value.value.value,
                        value: value.id,
                      }))}
                  />
                )}
              </FormField>
            ) : null}

            {BADGE_NUMBERS ? (
              <TextField
                errorMessage={errors.badgeNumberString}
                label={t("Leo.badgeNumber")}
                name="badgeNumberString"
                onChange={(value) => setFieldValue("badgeNumberString", value)}
                value={values.badgeNumberString}
              />
            ) : null}

            <FormRow>
              <TextField
                errorMessage={errors.callsign}
                label={t("Leo.callsign1")}
                name="callsign"
                onChange={(value) => setFieldValue("callsign", value)}
                value={values.callsign}
              />

              <TextField
                errorMessage={errors.callsign2}
                label={t("Leo.callsign2")}
                name="callsign2"
                onChange={(value) => setFieldValue("callsign2", value)}
                value={values.callsign2}
              />
            </FormRow>

            <CallSignPreview
              department={department.values.find((v) => v.id === values.department) ?? null}
              divisions={values.divisions}
            />

            <footer className="flex mt-5 justify-end">
              <div className="flex">
                <Button onPress={handleClose} type="button" variant="cancel">
                  {common("cancel")}
                </Button>
                <Button className="flex items-center ml-2" type="submit">
                  {state === "loading" ? <Loader className="mr-2 border-red-200" /> : null}
                  {common("create")}
                </Button>
              </div>
            </footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
