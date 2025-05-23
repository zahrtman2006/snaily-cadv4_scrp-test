import { useTranslations } from "next-intl";
import { ModalButton, ModalButtonArgs } from "./buttons";
import { Button } from "@snailycad/ui";
import { useFeatureEnabled } from "hooks/useFeatureEnabled";
import { useActiveDispatchers } from "hooks/realtime/use-active-dispatchers";
import { useModal } from "state/modalState";
import { useRouter } from "next/router";
import { EmsFdDeputy } from "@snailycad/types";
import { ActiveOfficer } from "state/leo-state";
import { useAuth } from "context/AuthContext";

type ButtonProps = Pick<
  React.JSX.IntrinsicElements["button"],
  "name" | "type" | "title" | "disabled"
>;
interface Props extends ButtonProps {
  button: ModalButton;
  unit?: ActiveOfficer | EmsFdDeputy | null;
}

export function ModalButton({ button: buttonFn, unit, ...buttonProps }: Props) {
  const t = useTranslations();
  const features = useFeatureEnabled();
  const { hasActiveDispatchers } = useActiveDispatchers();
  const modalState = useModal();
  const router = useRouter();
  const { user } = useAuth();

  const isDispatch = router.pathname === "/dispatch";
  const btnArgs = { ...features, hasActiveDispatchers, isDispatch, unit, user };
  const button = buttonFn(btnArgs as ModalButtonArgs<any>);
  const isEnabled = button.isEnabled ?? true;

  if (!isEnabled) {
    return null;
  }

  return (
    <Button
      id={button.nameKey[1]}
      disabled={buttonProps.disabled}
      title={buttonProps.disabled ? "Go on-duty before continuing" : t(button.nameKey.join("."))}
      onPress={() => modalState.openModal(button.modalId)}
      type="button"
      {...buttonProps}
      className="text-base"
    >
      {t(button.nameKey.join("."))}
    </Button>
  );
}
