import { setInteractionModality } from "@react-aria/interactions";
import { useField } from "@react-aria/label";
import { useMenuTrigger } from "@react-aria/menu";
import { filterDOMProps, mergeProps, useId } from "@react-aria/utils";
import * as React from "react";

import { MultiSelectProps as MultiSelectStateProps, MultiSelectState } from "./useMultiSelectState";
import { AriaSelectProps } from "@react-types/select";
import { AriaButtonOptions } from "@react-aria/button";
import { DOMAttributes, FocusableElement } from "@react-types/shared";

interface MultiSelectProps<T> extends Omit<AriaSelectProps<T>, "onSelectionChange"> {
  disallowEmptySelection?: boolean;
  onSelectionChange?: MultiSelectStateProps<T>["onSelectionChange"];
}

interface UseMultiSelect {
  triggerProps: AriaButtonOptions<"button">;
  labelProps: Record<string, unknown>;
  errorMessageProps: DOMAttributes<FocusableElement>;
  valueProps: Record<string, unknown>;
  menuProps: Record<string, unknown>;
}

export function useMultiSelect<T>(
  props: MultiSelectProps<T>,
  state: MultiSelectState<T>,
  ref: React.RefObject<HTMLElement>,
): UseMultiSelect {
  const { disallowEmptySelection, isDisabled } = props;

  const { menuTriggerProps, menuProps } = useMenuTrigger(
    { isDisabled, type: "listbox" },
    state,
    ref,
  );

  const { labelProps, errorMessageProps, fieldProps } = useField(props);

  const domProps = filterDOMProps(props, { labelable: true });
  const triggerProps = mergeProps(menuTriggerProps, fieldProps);
  const valueId = useId();

  return {
    errorMessageProps,
    labelProps: {
      ...labelProps,
      onClick: () => {
        if (state.isFocused) return;

        if (!isDisabled) {
          ref.current?.focus();
          state.setIsFocused(true);
          setInteractionModality("keyboard");

          state.setOpen(true);
        }
      },
    },
    triggerProps: mergeProps(domProps, {
      ...triggerProps,
      onFocus(e: React.FocusEvent) {
        if (state.isFocused) return;
        state.setIsFocused(true);

        if (props.onFocus) {
          props.onFocus(e);
        }
      },
      onBlur(e: React.FocusEvent) {
        if (state.isOpen) return;
        state.setIsFocused(false);

        if (props.onBlur) {
          props.onBlur(e);
        }
      },
    }),
    valueProps: { id: valueId },
    menuProps: {
      ...menuProps,
      disallowEmptySelection,
      shouldSelectOnPressUp: true,
    },
  };
}
