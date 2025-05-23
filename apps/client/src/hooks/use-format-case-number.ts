import { useAuth } from "context/AuthContext";
import { formatCaseNumber, _Record } from "@snailycad/utils/case-number";
import { Warrant } from "@snailycad/types";

export function useFormatCaseNumber() {
  const { cad } = useAuth();
  const miscCadSettings = cad?.miscCadSettings;

  function _formatCaseNumber(record: _Record | Warrant | null) {
    if (!record) return "";
    return formatCaseNumber(record, miscCadSettings?.caseNumberTemplate ?? null);
  }

  return { formatCaseNumber: _formatCaseNumber };
}
