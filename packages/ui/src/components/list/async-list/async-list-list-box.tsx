import * as React from "react";
import { AriaListBoxOptions } from "@react-aria/listbox";
import { ListState } from "@react-stately/list";
import { useListBox } from "@react-aria/listbox";
import { AsyncListFieldOption } from "./async-list-option";

interface ListBoxProps<T> extends AriaListBoxOptions<T> {
  listBoxRef?: React.RefObject<HTMLUListElement>;
  state: ListState<T>;
}

export function AsyncListFieldListBox<T>(props: ListBoxProps<T>) {
  const ref = React.useRef<HTMLUListElement>(null);
  const { listBoxRef = ref, state } = props;
  const { listBoxProps } = useListBox(props, state, listBoxRef);

  return (
    <ul {...listBoxProps} ref={listBoxRef} className="max-h-72 overflow-auto outline-none">
      {[...state.collection].map((item) => (
        <AsyncListFieldOption<T> key={item.key} item={item} state={state} />
      ))}
    </ul>
  );
}
