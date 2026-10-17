# GPUI events

Use handlers such as `onClick`, `onMouseDown`, `onKeyDown`, `onFocus`, `onBlur`, `onInput`, `onChange`, and `onScroll`. Native event payloads reflect GPUI input, not DOM events. The same Retend modifier syntax (for example `onClick--stop`) is supported.

`input` and `textarea` are native text editors with `value` and `placeholder`. Use a Cell for controlled state, and read `event.value` on change/input. `button` supports `disabled`. `img` supports `onLoad` and `onError`. `audio` supports `onEnded` and `onError` and is played through its element ref. A native element `ref` can call focus and selection methods as appropriate.

API: https://retend.dev/docs/gpui-events
