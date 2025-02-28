export namespace JSX {
  type Booleanish = boolean | 'true' | 'false';
  type Numberish = number | `${number}`;

  type Properties = import('csstype').Properties<string | number> &
    import('csstype').PropertiesHyphen<string | number>;

  interface CSSProperties extends Properties {
    [v: `--${string}`]: string | number | undefined;
  }

  type StyleValue =
    | false
    | null
    | undefined
    | string
    | CSSProperties
    | Container<ValueOrCell<CSSProperties>>
    | Array<StyleValue>;

  type HTMLAttributeReferrerPolicy =
    | ''
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';

  type InputTypeHTMLAttribute =
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'submit'
    | 'tel'
    | 'text'
    | 'time'
    | 'url'
    | 'week';

  interface GlobalEvents {
    /**
     * Fired when a resource load is aborted, such as by a user canceling the load.
     */
    onAbort: UIEvent;

    /**
     * Occurs when a CSS animation is canceled unexpectedly.
     */
    onAnimationCancel: AnimationEvent;

    /**
     * Fired when a CSS animation reaches its end.
     */
    onAnimationEnd: AnimationEvent;

    /**
     * Triggered when a CSS animation repeats.
     */
    onAnimationIteration: AnimationEvent;

    /**
     * Fired when a CSS animation begins.
     */
    onAnimationStart: AnimationEvent;

    /**
     * Occurs when a non-primary pointer button (e.g., middle mouse button) is pressed on an element.
     */
    onAuxClick: MouseEvent;

    /**
     * Fired just before text is inserted into an editable element.
     */
    onBeforeInput: InputEvent;

    /**
     * Triggered before a `<details>` element is toggled between open and closed states.
     */
    onBeforeToggle: Event;

    /**
     * Fired when an element loses focus. Does not bubble.
     */
    onBlur: FocusEvent;

    /**
     * Occurs when a user dismisses a cancelable element, such as closing a dialog.
     */
    onCancel: Event;

    /**
     * Fired when media can start playing, but might need to stop for further buffering.
     */
    onCanPlay: Event;

    /**
     * Occurs when media can play through to the end without interruption.
     */
    onCanPlayThrough: Event;

    /**
     * Fired when the value of an input element changes.
     */
    onChange: Event;

    /**
     * Occurs when a pointing device button (usually a mouse) is pressed and released on an element.
     */
    onClick: MouseEvent;

    /**
     * Fired when a window or tab is closed.
     */
    onClose: Event;

    /**
     * Occurs when a text composition system finishes composing text.
     */
    onCompositionEnd: CompositionEvent;

    /**
     * Fired when a text composition system starts composing text.
     */
    onCompositionStart: CompositionEvent;

    /**
     * Occurs when a text composition is updated.
     */
    onCompositionUpdate: CompositionEvent;

    /**
     * Fired when the right mouse button is pressed to open a context menu.
     */
    onContextMenu: MouseEvent;

    /**
     * Occurs when the user copies text to the clipboard.
     */
    onCopy: ClipboardEvent;

    /**
     * Fired when a text track has changed the currently displaying cues.
     */
    onCueChange: Event;

    /**
     * Occurs when the user cuts text to the clipboard.
     */
    onCut: ClipboardEvent;

    /**
     * Fired when a pointing device button is clicked twice on an element.
     */
    onDblClick: MouseEvent;

    /**
     * Occurs when an element or text selection is being dragged.
     */
    onDrag: DragEvent;

    /**
     * Fired when a drag operation ends.
     */
    onDragEnd: DragEvent;

    /**
     * Occurs when a dragged element or text selection enters a valid drop target.
     */
    onDragEnter: DragEvent;

    /**
     * Fired when a dragged element or text selection leaves a valid drop target.
     */
    onDragLeave: DragEvent;

    /**
     * Occurs when an element or text selection is being dragged over a valid drop target.
     */
    onDragOver: DragEvent;

    /**
     * Fired when the user starts dragging an element or text selection.
     */
    onDragStart: DragEvent;

    /**
     * Occurs when an element is dropped on a valid drop target.
     */
    onDrop: DragEvent;

    /**
     * Fired when the duration of media changes.
     */
    onDurationChange: Event;

    /**
     * Occurs when a media element is reset to its initial state.
     */
    onEmptied: Event;

    /**
     * Fired when media playback has stopped because the end of the media was reached.
     */
    onEnded: Event;

    /**
     * Occurs when a resource failed to load or couldn't be used.
     */
    onError: ErrorEvent;

    /**
     * Fired when an element receives focus. Does not bubble.
     */
    onFocus: FocusEvent;

    /**
     * Occurs when an element is about to receive focus.
     */
    onFocusIn: FocusEvent;

    /**
     * Fired when an element is about to lose focus.
     */
    onFocusOut: FocusEvent;

    /**
     * Occurs when a form's data is updated.
     */
    onFormData: FormDataEvent;

    /**
     * Fired when an element captures a pointer using setPointerCapture().
     */
    onGotPointerCapture: PointerEvent;

    /**
     * Occurs when the value of an input element changes.
     */
    onInput: Event;

    /**
     * Fired when a submittable element has been checked for validity and doesn't satisfy its constraints.
     */
    onInvalid: Event;

    /**
     * Occurs when a key is pressed down.
     */
    onKeyDown: KeyboardEvent;

    /**
     * @deprecated
     * Fired when a key that produces a character value is pressed down. Deprecated in favor of beforeinput or keydown.
     */
    onKeyPress: KeyboardEvent;

    /**
     * Occurs when a key is released.
     */
    onKeyUp: KeyboardEvent;

    /**
     * Fired when a resource and its dependent resources have finished loading.
     */
    onLoad: Event;

    /**
     * Occurs when media data is loaded.
     */
    onLoadedData: Event;

    /**
     * Fired when metadata of media has been loaded.
     */
    onLoadedMetadata: Event;

    /**
     * Occurs when the browser starts looking for specified media.
     */
    onLoadStart: Event;

    /**
     * Fired when an element loses pointer capture.
     */
    onLostPointerCapture: PointerEvent;

    /**
     * Occurs when a pointing device button is pressed on an element.
     */
    onMouseDown: MouseEvent;

    /**
     * Fired when a pointing device is moved onto an element. Does not bubble.
     */
    onMouseEnter: MouseEvent;

    /**
     * Occurs when a pointing device is moved off an element. Does not bubble.
     */
    onMouseLeave: MouseEvent;

    /**
     * Fired when a pointing device is moved over an element.
     */
    onMouseMove: MouseEvent;

    /**
     * Occurs when a pointing device is moved off an element.
     */
    onMouseOut: MouseEvent;

    /**
     * Fired when a pointing device is moved onto an element or one of its children.
     */
    onMouseOver: MouseEvent;

    /**
     * Occurs when a pointing device button is released over an element.
     */
    onMouseUp: MouseEvent;

    /**
     * Fired when the user pastes text from the clipboard.
     */
    onPaste: ClipboardEvent;

    /**
     * Occurs when media playback is paused.
     */
    onPause: Event;

    /**
     * Fired when media playback is ready to start after having been paused.
     */
    onPlay: Event;

    /**
     * Occurs when media starts playing.
     */
    onPlaying: Event;

    /**
     * Fired when a pointer event is canceled.
     */
    onPointerCancel: PointerEvent;

    /**
     * Occurs when a pointer becomes active.
     */
    onPointerDown: PointerEvent;

    /**
     * Fired when a pointer enters the hit test boundaries of an element. Does not bubble.
     */
    onPointerEnter: PointerEvent;

    /**
     * Occurs when a pointer leaves the hit test boundaries of an element. Does not bubble.
     */
    onPointerLeave: PointerEvent;

    /**
     * Fired when a pointer changes coordinates.
     */
    onPointerMove: PointerEvent;

    /**
     * Occurs when a pointer leaves the hit test boundaries of an element.
     */
    onPointerOut: PointerEvent;

    /**
     * Fired when a pointer enters the hit test boundaries of an element.
     */
    onPointerOver: PointerEvent;

    /**
     * Occurs when a pointer is no longer active.
     */
    onPointerUp: PointerEvent;

    /**
     * Fired periodically as the browser loads a resource.
     */
    onProgress: ProgressEvent;

    /**
     * Occurs when the playback rate of media changes.
     */
    onRateChange: Event;

    /**
     * Fired when a form is reset.
     */
    onReset: Event;

    /**
     * Occurs when the document view is resized.
     */
    onResize: UIEvent;

    /**
     * Fired when the document view or an element has been scrolled.
     */
    onScroll: Event;

    /**
     * Occurs when a scrolling interaction completes.
     */
    onScrollEnd: Event;

    /**
     * Fired when the browser detects a violation of its Content Security Policy.
     */
    onSecurityPolicyViolation: SecurityPolicyViolationEvent;

    /**
     * Occurs when the seeking attribute is set to false, indicating that seeking has ended.
     */
    onSeeked: Event;

    /**
     * Fired when the seeking attribute is set to true, indicating that seeking is active.
     */
    onSeeking: Event;

    /**
     * Occurs when text is selected in an input field.
     */
    onSelect: Event;

    /**
     * Fired when the text selection in an editable element changes.
     */
    onSelectionChange: Event;

    /**
     * Occurs when a user starts a new text selection.
     */
    onSelectStart: Event;

    /**
     * Fired when the contents of a slot element changes.
     */
    onSlotChange: Event;

    /**
     * Occurs when media data loading has stalled.
     */
    onStalled: Event;

    /**
     * Fired when a form is submitted.
     */
    onSubmit: SubmitEvent;

    /**
     * Occurs when media data loading has been suspended.
     */
    onSuspend: Event;

    /**
     * Fired when the time indicated by the currentTime attribute has updated.
     */
    onTimeUpdate: Event;

    /**
     * Occurs when a `<details>` element is toggled between open and closed states.
     */
    onToggle: Event;

    /**
     * Fired when a touch point is removed from the touch surface.
     */
    onTouchCancel: TouchEvent;

    /**
     * Occurs when a touch point is removed from the touch surface.
     */
    onTouchEnd: TouchEvent;

    /**
     * Fired when a touch point is moved along the touch surface.
     */
    onTouchMove: TouchEvent;

    /**
     * Occurs when a touch point is placed on the touch surface.
     */
    onTouchStart: TouchEvent;

    /**
     * Fired when a CSS transition is canceled.
     */
    onTransitionCancel: TransitionEvent;

    /**
     * Occurs when a CSS transition has completed.
     */
    onTransitionEnd: TransitionEvent;

    /**
     * Fired when a CSS transition is first created.
     */
    onTransitionRun: TransitionEvent;

    /**
     * Occurs when a CSS transition has actually started.
     */
    onTransitionStart: TransitionEvent;

    /**
     * Fired when the volume of media changes.
     */
    onVolumeChange: Event;

    /**
     * Occurs when media playback has stopped because it needs to buffer the next frame.
     */
    onWaiting: Event;

    /**
     * Fired when a CSS animation ends. WebKit prefix version.
     */
    onWebkitAnimationEnd: Event;

    /**
     * Occurs when a CSS animation repeats. WebKit prefix version.
     */
    onWebkitAnimationIteration: Event;

    /**
     * Fired when a CSS animation starts. WebKit prefix version.
     */
    onWebkitAnimationStart: Event;

    /**
     * Occurs when a CSS transition ends. WebKit prefix version.
     */
    onWebkitTransitionEnd: Event;

    /**
     * Fired when the user rotates a wheel button on a pointing device.
     */
    onWheel: WheelEvent;
  }

  type Modifiers = 'self' | 'prevent' | 'once' | 'passive' | 'stop';
  type AddModifierSuffix<
    T extends string | number | bigint | boolean | null | undefined
  > = `${T}--${Modifiers}`;
  type RemoveModifierSuffix<U> = U extends `${infer T}--${Modifiers}`
    ? T
    : never;

  type GlobalEventModifiers = {
    [modifier in AddModifierSuffix<
      keyof GlobalEvents
    >]: GlobalEvents[RemoveModifierSuffix<modifier>];
  };

  interface JsxAriaAttributes {
    /**
     * Identifies the element that is currently active within a group.
     * This supports one active descendant per group.
     */
    ariaActiveDescendant?: string;

    /**
     * Indicates whether an element is considered to be atomic for conveying its meaning to assistive technologies.
     */
    ariaAtomic?: Booleanish;

    /**
     * Indicates the type of autocompletion mechanism for this element, if any.
     */
    ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both';

    /**
     * Indicates whether the element is busy processing user input.
     */
    ariaBusy?: Booleanish;

    /**
     * Indicates the current checked state of a checkable element.
     * Can also be set to "mixed" for checkboxes with indeterminate state.
     */
    ariaChecked?: Booleanish | 'mixed';

    /**
     * Defines the number of columns in a grid or treegrid.
     */
    ariaColCount?: Numberish;

    /**
     * Defines the position of an element within a grid or treegrid.
     * Starts at 1.
     */
    ariaColIndex?: Numberish;

    /**
     * Defines the number of columns spanned by a cell or gridcell.
     */
    ariaColSpan?: Numberish;

    /**
     * Identifies the element(s) that are controlled by this element.
     * Useful for things like buttons and menus.
     */
    ariaControls?: string;

    /**
     * Indicates the current state of an element that supports pagination.
     * Can be page, step, location, date, or time.
     */
    ariaCurrent?: Booleanish | 'page' | 'step' | 'location' | 'date' | 'time';

    /**
     * Identifies the element(s) that describe the object.
     */
    ariaDescribedBy?: string;

    /**
     * Identifies the element that provides a detailed description of the element.
     */
    ariaDetails?: string;

    /**
     * Indicates that the element is disabled.
     */
    ariaDisabled?: Booleanish;

    /**
     * Defines what effects (e.g. copy, move) are allowed during drag and drop operations.
     */
    ariaDropEffect?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup';

    /**
     * Identifies the element that provides an error message for the user.
     */
    ariaErrorMessage?: string;

    /**
     * Indicates whether the element is currently expanded or collapsed.
     */
    ariaExpanded?: Booleanish;

    /**
     * Identifies the element(s) that are flowto for this UI element.
     */
    ariaFlowTo?: string;

    /**
     * Indicates that the element is currently grabbed by a pointing device.
     */
    ariaGrabbed?: Booleanish;

    /**
     * Indicates whether the element has a popup or flyout menu.
     * Can specify the type of popup as well (menu, listbox, etc).
     */
    ariaHasPopup?: Booleanish | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';

    /**
     * Indicates whether the element is hidden or not exposed to the user agent.
     */
    ariaHidden?: Booleanish;

    /**
     * Indicates whether the element is valid or invalid.
     * Can also specify the type of error (grammar, spelling).
     */
    ariaInvalid?: Booleanish | 'grammar' | 'spelling';

    /**
     * Identifies a keyboard shortcut for activating or manipulating an element.
     */
    ariaKeyShortcuts?: string;

    /**
     * Provides a string that describes the element to the user.
     */
    ariaLabel?: string;

    /**
     * Identifies the element(s) that label this element.
     */
    ariaLabelledBy?: string;

    /**
     * Defines the hierarchical level of an element within a structure.
     */
    ariaLevel?: Numberish;

    /**
     * Indicates how live updates are presented to the user.
     * Options are "off", "assertive", or "polite".
     */
    ariaLive?: 'off' | 'assertive' | 'polite';

    /**
     * Indicates that element is modal, meaning it blocks interaction with the browser underneath it.
     */
    ariaModal?: Booleanish;

    /**
     * Indicates whether the element can contain multiple lines of text.
     */
    ariaMultiline?: Booleanish;

    /**
     * Indicates whether multiple items can be selected within this element.
     */
    ariaMultiSelectable?: Booleanish;

    /**
     * Indicates the spatial orientation of the content.
     */
    ariaOrientation?: 'horizontal' | 'vertical';

    /**
     * Identifies the element(s) that are owned by this element.
     * Useful for things like tabs and menu items.
     */
    ariaOwns?: string;

    /**
     * Provides a placeholder text for an input field.
     */
    ariaPlaceholder?: string;

    /**
     * Defines the vertical offset from the insertion point.
     */
    ariaPosInset?: Numberish;

    /**
     * Indicates the current pressed state of a toggle button or switch.
     * Can also be set to "mixed" for indeterminate state.
     */
    ariaPressed?: Booleanish | 'mixed';

    /**
     * Indicates that the element is read-only.
     */
    ariaReadonly?: Booleanish;

    /**
     * Defines what updates are relevant to the user.
     * Many options including "text", "additions", "removals", etc.
     */
    ariaRelevant?:
      | 'additions'
      | 'additions removals'
      | 'additions text'
      | 'all'
      | 'removals'
      | 'removals additions'
      | 'removals text'
      | 'text'
      | 'text additions'
      | 'text removals';

    /**
     * Indicates that user input is required on this element.
     */
    ariaRequired?: Booleanish;

    /**
     * Defines a human-readable description for the element's role.
     */
    ariaRoleDescription?: string;

    /**
     * Defines the number of rows in a grid or treegrid.
     */
    ariaRowCount?: Numberish;

    /**
     * Defines the position of an element within a grid or treegrid.
     * Starts at 1.
     */
    ariaRowIndex?: Numberish;

    /**
     * Defines the number of rows spanned by a cell or gridcell.
     */
    ariaRowSpan?: Numberish;

    /**
     * Indicates whether the element is currently selected.
     */
    ariaSelected?: Booleanish;

    /**
     * Defines the total number of items in a set or collection.
     */
    ariaSetSize?: Numberish;

    /**
     * Indicates how data within the element is sorted.
     * Options are "none", "ascending", "descending", or "other".
     */
    ariaSort?: 'none' | 'ascending' | 'descending' | 'other';

    /**
     * Defines the maximum permitted value for a range element.
     */
    ariaValueMax?: Numberish;

    /**
     * Defines the minimum permitted value for a range element.
     */
    ariaValueMin?: Numberish;

    /**
     * Defines the current value for a range element.
     */
    ariaValueNow?: Numberish;

    /**
     * Provides the current value of the element as text.
     */
    ariaValueText?: string;
  }

  /**
   * Represents the global attributes available on JSX elements in TypeScript.
   */
  interface JSXGlobalAttributes {
    /**
     * Sets or retrieves the HTML content (inner markup) of an element.
     */
    innerHTML?: string;

    /**
     * Assigns a space-separated list of CSS classes to the element.
     */
    // The class can be a string, an array of string, an iterable,
    // an object with string keys, or a combination of the above.
    // It is hard to type.
    class?: unknown;

    /**
     * Defines inline CSS styles for the element. Can be a string or an object.
     */
    style?: StyleValue;

    /**
     * Keyboard shortcut to activate or focus the element.
     */
    accessKey?: string;

    /**
     * Whether the element's content is editable or not.
     * Can be a boolean, 'inherit', or 'plaintext-only'.
     */
    contenteditable?: Booleanish | 'inherit' | 'plaintext-only';

    /**
     * The associated context menu of the element, identified by its ID.
     */
    contextMenu?: string;

    /**
     * Specifies the element's text direction (LTR or RTL).
     */
    dir?: string;

    /**
     * Defines whether the element can be dragged or not.
     * Can be a boolean or undefined.
     */
    draggable?: Booleanish;

    /**
     * Whether the element is hidden or not.
     * Can be a boolean, '', 'hidden', or 'until-found'.
     */
    hidden?: Booleanish | '' | 'hidden' | 'until-found';

    /**
     * Specifies the name of the slot that the element is assigned to.
     */
    slot?: string;

    /**
     * Uniquely identifies the element within a document.
     */
    id?: string;

    /**
     * Indicates that the element should not be included in tab navigation.
     * Can be a boolean or undefined.
     */
    inert?: Booleanish;

    /**
     * Specifies the element's language.
     */
    lang?: string;

    /**
     * Defines a part of the element that can be styled from
     * outside the shadow DOM.
     */
    part?: string;

    /**
     * A hint for the type of text expected in an input field.
     */
    placeholder?: string;

    /**
     * Enables or disables spell checking on the element.
     * Can be a boolean or undefined.
     */
    spellcheck?: Booleanish;

    /**
     * Sets the element's position in the tab order.
     */
    tabIndex?: Numberish;

    /**
     * Advisory text information about the element.
     */
    title?: string;

    /**
     * Specifies whether the content of an element should be translated or not.
     */
    translate?: 'yes' | 'no';

    /**
     * The name of the radio group that the radio button belongs to.
     */
    radioGroup?: string;

    /**
     * Defines an expected attribute type for an element.
     */
    role?: string;

    /**
     * Optional metadata about the element, similar to the `about` attribute in HTML.
     */
    about?: string;

    /**
     * A machine-readable definition of the content type of the element.
     */
    dataType?: string;

    /**
     * A hint for the type of data expected for the property specified by the 'property' attribute.
     */
    prefix?: string;

    /**
     * The name of the property the element represents.
     */
    property?: string;

    /**
     * A URI that describes the resource referenced by the element.
     */
    resource?: string;

    /**
     * The expected MIME type of the resource.
     */
    typeof?: string;

    /**
     * A vocabulary for defining or describing groups of related items.
     */
    vocab?: string;

    /**
     * Controls the capitalization of text entered into an element.
     */
    autoCapitalize?: string;

    /**
     * Enables or disables autocorrection for the element's content.
     */
    autoCorrect?: string;

    /**
     * Configures the behavior of the on-screen keyboard for the element.
     */
    autoSave?: string;

    /**
     * The foreground (text) color of the element.
     */
    color?: string;

    /**
     * Defines a property that specifies one or more item properties for microdata.
     */
    itemProp?: string;

    /**
     * Specifies whether the element is part of an item scope.
     * Can be a boolean or undefined.
     */
    itemScope?: Booleanish;

    /**
     * Specifies the element's scope (e.g., for microdata).
     */
    itemType?: string;

    /**
     * References one or more elements that are considered part of the same item.
     */
    itemRef?: string;

    /**
     * Defines the expected number of results displayed for a search operation.
     */
    results?: Numberish;

    /**
     * Defines security risks on the element.
     */
    security?: string;

    /**
     * Indicates whether an element's content can be selected by the user.
     */
    unselectable?: 'on' | 'off';

    /**
     * Controls the type of input method to be used for the element.
     */
    inputMode?:
      | 'none'
      | 'text'
      | 'tel'
      | 'url'
      | 'email'
      | 'numeric'
      | 'decimal'
      | 'search';

    /**
     * Turns an element into a popover element; takes a popover state ("auto" or "manual") as its value.
     */
    popover?: Booleanish | 'auto' | 'manual';
  }

  type JsxGlobalEventHandlers<E> = {
    [K in keyof GlobalEvents]?: (this: E, event: GlobalEvents[K]) => void;
  } & {
    [K in keyof GlobalEventModifiers]?: (
      this: E,
      event: GlobalEventModifiers[K]
    ) => void;
  };

  export type Children = unknown;

  interface JsxNativeProps {
    key?: string | number;
    ref?: import('@adbl/cells').Cell<unknown>;
    children?: Children;
    dangerouslySetInnerHTML?: {
      __html: string;
    };
    xmlns?: string;
  }

  type DatasetAttributes = Record<`data-${string}`, string>;

  interface JsxHtmlElement<E = HTMLElement>
    extends JSXGlobalAttributes,
      JsxAriaAttributes,
      JsxGlobalEventHandlers<E>,
      DatasetAttributes,
      JsxNativeProps {}

  interface JsxHtmlAnchorElement extends JsxHtmlElement<HTMLAnchorElement> {
    /**
     * Specifies the filename of the linked content when downloaded.
     */
    download?: string;

    /**
     * Sets the URL of the linked content.
     */
    href?: string;

    /**
     * Defines the language of the linked content.
     */
    hreflang?: string;

    /**
     * Specifies the media types that the link applies to.
     */
    media?: string;

    /**
     * A space-separated list of URLs that should be pinged when the link is clicked.
     */
    ping?: string;

    /**
     * Defines the relationship between the current document and the linked content.
     */
    rel?: string;

    /**
     * Sets the name of the frame to display the linked content.
     */
    target?: string;

    /**
     * Specifies the media type of the linked content.
     */
    type?: string;

    /**
     * Defines which referrer information to send when following the link.
     */
    referrerpolicy?: HTMLAttributeReferrerPolicy;
  }

  interface JsxAreaElement extends JsxHtmlElement<HTMLAreaElement> {
    /**
     * Alternative text for the link.
     */
    alt?: string;

    /**
     * Coordinates for the area of a link.
     */
    coords?: string;

    /**
     * Indicates that the linked resource should be downloaded instead of navigating to it.
     */
    download?: string;

    /**
     * The URL of the linked resource.
     */
    href?: string;

    /**
     * The language of the linked resource.
     */
    hreflang?: string;

    /**
     * The media type of the linked resource.
     */
    media?: string;

    /**
     * The referrer policy for the link.
     */
    referrerpolicy?: HTMLAttributeReferrerPolicy;

    /**
     * The relationship between the current document and the linked resource.
     */
    rel?: string;

    /**
     * The shape of the link area.
     */
    shape?: string;

    /**
     * The target for the linked resource.
     */
    target?: string;
  }
  interface JsxAudioElement extends JsxHtmlElement<HTMLAudioElement> {
    /**
     * Specifies that the audio will automatically start playing as soon as it can do so without stopping.
     */
    autoplay?: Booleanish;

    /**
     * Specifies that audio controls should be displayed.
     */
    controls?: Booleanish;

    /**
     * Specifies that the audio will start over again every time it is finished.
     */
    loop?: Booleanish;

    /**
     * Specifies that the audio output should be muted.
     */
    muted?: Booleanish;

    /**
     * Specifies the URL of the audio file.
     */
    src?: string;

    /**
     * Specifies if and how the author thinks the audio should be loaded when the page loads.
     */
    preload?: 'auto' | 'metadata' | 'none';
  }

  interface JsxBaseElement extends JsxHtmlElement<HTMLBaseElement> {
    /**
     * Specifies the base URL for all relative URLs in the page.
     */
    href?: string;

    /**
     * Specifies the default target for all hyperlinks and forms in the page.
     */
    target?: string;
  }

  interface JsxBodyElement extends JsxHtmlElement<HTMLBodyElement> {
    /**
     * Fires when the user is about to leave the page.
     */
    onBeforeUnload?: (event: BeforeUnloadEvent) => void;
    'onBeforeUnload--self'?: (
      this: HTMLBodyElement,
      event: BeforeUnloadEvent
    ) => void;
    'onBeforeUnload--prevent'?: (
      this: HTMLBodyElement,
      event: BeforeUnloadEvent
    ) => void;
    'onBeforeUnload--stop'?: (
      this: HTMLBodyElement,
      event: BeforeUnloadEvent
    ) => void;
    'onBeforeUnload--once'?: (
      this: HTMLBodyElement,
      event: BeforeUnloadEvent
    ) => void;
    'onBeforeUnload--passive'?: (
      this: HTMLBodyElement,
      event: BeforeUnloadEvent
    ) => void;
  }

  interface JsxHtmlButtonElement extends JsxHtmlElement<HTMLButtonElement> {
    /**
     * Automatically focuses the button when the page loads.
     */
    autofocus?: Booleanish;

    /**
     * Disables the button, making it non-interactive.
     */
    disabled?: Booleanish;

    /**
     * Associates the button with a form element.
     */
    form?: string;

    /**
     * Specifies the URL to process the form submission.
     */
    formAction?: string;

    /**
     * Specifies how form data should be encoded when submitting.
     */
    formEnctype?: string;

    /**
     * Specifies the HTTP method to use when submitting the form.
     */
    formMethod?: string;

    /**
     * Specifies that form validation should not be performed when submitting.
     */
    formNoValidate?: Booleanish;

    /**
     * Specifies where to display the response after submitting the form.
     */
    formTarget?: string;

    /**
     * Specifies a name for the button.
     */
    name?: string;

    /**
     * Specifies the type of button.
     */
    type?: 'submit' | 'reset' | 'button';

    /**
     * Specifies the initial value for the button.
     */
    value?: string | ReadonlyArray<string> | number;

    /**
     * Adds a popover control to the button taking the ID of the popover element to control as its value.
     */
    popoverTarget?: string;

    /**
     * Specifies the action to be triggered on the popover element set as the popover target.
     */
    popoverTargetAction?: 'hide' | 'show' | 'toggle';
  }

  interface JsxCanvasElement extends JsxHtmlElement<HTMLCanvasElement> {
    /**
     * Specifies the height of the canvas.
     */
    height?: number | string;

    /**
     * Specifies the width of the canvas.
     */
    width?: number | string;
  }

  interface JsxTableCaptionElement
    extends JsxHtmlElement<HTMLTableCaptionElement> {
    /**
     * Specifies the alignment of the caption.
     * @deprecated This attribute is not supported in HTML5.
     */
    align?: 'top' | 'bottom' | 'left' | 'right';
  }

  interface JsxDataElement extends JsxHtmlElement<HTMLDataElement> {
    /**
     * Specifies the machine-readable translation of the content.
     */
    value?: string;
  }

  interface JsxDataListElement extends JsxHtmlElement<HTMLDataListElement> {
    // DataList element typically doesn't have any specific attributes
  }

  interface JsxDetailsElement extends JsxHtmlElement<HTMLDetailsElement> {
    /**
     * Specifies whether the details should be visible (open) to the user.
     */
    open?: Booleanish;
  }

  interface JsxDialogElement extends JsxHtmlElement<HTMLDialogElement> {
    /**
     * Indicates that the dialog is active and can be interacted with.
     */
    open?: Booleanish;
  }

  interface JsxDListElement extends JsxHtmlElement<HTMLDListElement> {
    // DList element typically doesn't have any specific attributes
  }

  interface JsxEmbedElement extends JsxHtmlElement<HTMLEmbedElement> {
    /**
     * Specifies the height of the embedded content.
     */
    height?: number | string;

    /**
     * Specifies the address of the external file to embed.
     */
    src?: string;

    /**
     * Specifies the MIME type of the embedded content.
     */
    type?: string;

    /**
     * Specifies the width of the embedded content.
     */
    width?: number | string;
  }

  interface JsxFieldSetElement extends JsxHtmlElement<HTMLFieldSetElement> {
    /**
     * Specifies that the fieldset should be disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies which form the fieldset belongs to.
     */
    form?: string;

    /**
     * Specifies a name for the fieldset.
     */
    name?: string;
  }

  interface JsxFormElement extends JsxHtmlElement<HTMLFormElement> {
    /**
     * Specifies the character encodings that are to be used for the form submission.
     */
    acceptCharset?: string;

    /**
     * Specifies where to send the form-data when a form is submitted.
     */
    action?: string;

    /**
     * Specifies whether the form should have autocomplete on or off.
     */
    autoComplete?: 'on' | 'off';

    /**
     * Specifies how the form-data should be encoded when submitting it to the server.
     */
    encType?: string;

    /**
     * Specifies the HTTP method to use when sending form-data.
     */
    method?: 'get' | 'post';

    /**
     * Specifies the name of the form.
     */
    name?: string;

    /**
     * Specifies that the form should not be validated when submitted.
     */
    noValidate?: Booleanish;

    /**
     * Specifies where to display the response that is received after submitting the form.
     */
    target?: string;
  }

  interface JsxHeadElement extends JsxHtmlElement<HTMLHeadElement> {
    // Head element typically doesn't have any specific attributes
  }

  interface JsxHRElement extends JsxHtmlElement<HTMLHRElement> {
    // HR element typically doesn't have any specific attributes in modern HTML
  }

  interface JsxIFrameElement extends JsxHtmlElement<HTMLIFrameElement> {
    /**
     * Specifies a feature policy for the `<iframe>`.
     */
    allow?: string;

    /**
     * Set to true to allow fullscreen mode.
     */
    allowFullScreen?: Booleanish;

    /**
     * Specifies the height of the iframe.
     */
    height?: number | string;

    /**
     * Specifies which referrer information to send when fetching the frame's resource.
     */
    referrerPolicy?: HTMLAttributeReferrerPolicy;

    /**
     * Specifies extra HTML attributes for the iframe.
     */
    sandbox?: string;

    /**
     * Specifies the address of the document to embed in the iframe.
     */
    src?: string;

    /**
     * Specifies the content to be displayed in browsers that do not support iframes.
     */
    srcdoc?: string;

    /**
     * Specifies the width of the iframe.
     */
    width?: number | string;
  }

  interface JsxImageElement extends JsxHtmlElement<HTMLImageElement> {
    /**
     * Specifies an alternate text for the image.
     */
    alt?: string;

    /**
     * Specifies the height of the image.
     */
    height?: number | string;

    /**
     * Specifies whether the image is a server-side image map.
     */
    isMap?: Booleanish;

    /**
     * Specifies an image as a client-side image map.
     */
    useMap?: string;

    /**
     * Specifies the URL of the image.
     */
    src?: string;

    /**
     * Specifies a list of image URLs to use in different situations.
     */
    srcSet?: string;

    /**
     * Specifies the width of the image.
     */
    width?: number | string;

    /**
     * Specifies how the image should be loaded.
     */
    loading?: 'eager' | 'lazy';
  }

  interface JsxInputElement extends JsxHtmlElement<HTMLInputElement> {
    /**
     * Specifies that the input should automatically get focus when the page loads.
     */
    autoFocus?: Booleanish;

    /**
     * Specifies whether the input is checked.
     */
    checked?: Booleanish;

    /**
     * Specifies that the input field is disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies the form the input belongs to.
     */
    form?: string;

    /**
     * Specifies the URL of the file to use as the form submission value.
     */
    formAction?: string;

    /**
     * Specifies how form-data should be encoded before sending it to a server.
     */
    formEncType?: string;

    /**
     * Specifies the HTTP method to use when sending form-data.
     */
    formMethod?: string;

    /**
     * Specifies that the form-data should not be validated on submission.
     */
    formNoValidate?: Booleanish;

    /**
     * Specifies where to display the response after submitting the form.
     */
    formTarget?: string;

    /**
     * Specifies the maximum value for an input field.
     */
    max?: number | string;

    /**
     * Specifies the maximum number of characters allowed in the textarea.
     */
    maxlength?: Numberish;

    /**
     * Specifies a minimum value for an input field.
     */
    min?: number | string;

    /**
     * Specifies the minimum number of characters allowed in the textarea.
     */
    minlength?: Numberish;

    /**
     * Specifies that a user can enter more than one value in an input field.
     */
    multiple?: Booleanish;

    /**
     * Specifies the name of the input element.
     */
    name?: string;

    /**
     * Specifies a regular expression that the input's value is checked against.
     */
    pattern?: string;

    /**
     * Specifies a short hint that describes the expected value of the input field.
     */
    placeholder?: string;

    /**
     * Specifies that the input field is read-only.
     */
    readOnly?: Booleanish;

    /**
     * Specifies that the input field must be filled out before submitting the form.
     */
    required?: Booleanish;

    /**
     * Specifies the visible width of a text input.
     */
    size?: number;

    /**
     * Specifies the URL of the image to use as a submit button.
     */
    src?: string;

    /**
     * Specifies the interval between legal numbers in an input field.
     */
    step?: number | string;

    /**
     * Specifies the type of input element to display.
     */
    type?: InputTypeHTMLAttribute;

    /**
     * Specifies the value of the input element.
     */
    value?: string | ReadonlyArray<string> | number;

    /**
     * Adds a popover control to the button taking the ID of the popover element to control as its value.
     */
    popoverTarget?: string;

    /**
     * Specifies the action to be triggered on the popover element set as the popover target.
     */
    popoverTargetAction?: 'hide' | 'show' | 'toggle';
  }

  interface JsxLabelElement extends JsxHtmlElement<HTMLLabelElement> {
    /**
     * Specifies which form element a label is bound to.
     */
    for?: string;

    /**
     * Specifies the form that the label belongs to.
     */
    form?: string;
  }

  interface JsxLegendElement extends JsxHtmlElement<HTMLLegendElement> {
    // Legend element typically doesn't have any specific attributes
  }

  interface JsxLIElement extends JsxHtmlElement<HTMLLIElement> {
    /**
     * Specifies the value of a list item. Only for ordered lists.
     */
    value?: number;
  }

  interface JsxLinkElement extends JsxHtmlElement<HTMLLinkElement> {
    /**
     * Specifies how the element handles cross-origin requests.
     */
    crossOrigin?: string;

    /**
     * Specifies the URL of the linked resource.
     */
    href?: string;

    /**
     * Specifies the language of the linked resource.
     */
    hrefLang?: string;

    /**
     * Specifies on which media/device the linked resource should be displayed.
     */
    media?: string;

    /**
     * Specifies which referrer information to send with the linked resource.
     */
    referrerPolicy?: HTMLAttributeReferrerPolicy;

    /**
     * Specifies the relationship between the current document and the linked resource.
     */
    rel?: string;

    /**
     * Specifies the size of the linked resource. Only for rel="icon".
     */
    sizes?: string;

    /**
     * Specifies the media type of the linked resource.
     */
    type?: string;
  }

  interface JsxMapElement extends JsxHtmlElement<HTMLMapElement> {
    /**
     * Specifies the name of the map element.
     */
    name?: string;
  }

  interface JsxMenuElement extends JsxHtmlElement<HTMLMenuElement> {
    /**
     * Specifies the type of menu to display.
     */
    type?: 'context' | 'toolbar';
  }

  interface JsxMetaElement extends JsxHtmlElement<HTMLMetaElement> {
    /**
     * Specifies the character encoding for the HTML document.
     */
    charset?: string;

    /**
     * Specifies the value associated with the http-equiv or name attribute.
     */
    content?: string;

    /**
     * Specifies an HTTP header for the information in the content attribute.
     */
    httpEquiv?: string;

    /**
     * Specifies a name for the metadata.
     */
    name?: string;
  }

  interface JsxMeterElement extends JsxHtmlElement<HTMLMeterElement> {
    /**
     * Specifies the form that the meter element belongs to.
     */
    form?: string;

    /**
     * Specifies the range that is considered to be a high value.
     */
    high?: number;

    /**
     * Specifies the range that is considered to be a low value.
     */
    low?: number;

    /**
     * Specifies the maximum value of the range.
     */
    max?: number;

    /**
     * Specifies the minimum value of the range.
     */
    min?: number;

    /**
     * Specifies the optimal value of the range.
     */
    optimum?: number;

    /**
     * Specifies the current value of the gauge.
     */
    value?: number | string;
  }

  interface JsxObjectElement extends JsxHtmlElement<HTMLObjectElement> {
    /**
     * Specifies the URL of the resource to be used by the object.
     */
    data?: string;

    /**
     * Specifies the form that the object element belongs to.
     */
    form?: string;

    /**
     * Specifies the height of the object.
     */
    height?: number | string;

    /**
     * Specifies the name of the object element.
     */
    name?: string;

    /**
     * Specifies the content type of data specified in the data attribute.
     */
    type?: string;

    /**
     * Specifies the name of a client-side image map to be used with the object.
     */
    useMap?: string;

    /**
     * Specifies the width of the object.
     */
    width?: number | string;
  }

  interface JsxOListElement extends JsxHtmlElement<HTMLOListElement> {
    /**
     * Specifies that the list order should be reversed (9,8,7...).
     */
    reversed?: Booleanish;

    /**
     * Specifies the start value of an ordered list.
     */
    start?: number;

    /**
     * Specifies the kind of marker to use in the list.
     */
    type?: '1' | 'a' | 'A' | 'i' | 'I';
  }

  interface JsxOptGroupElement extends JsxHtmlElement<HTMLOptGroupElement> {
    /**
     * Specifies that an option-group should be disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies a label for an option-group.
     */
    label?: string;
  }

  interface JsxOptionElement extends JsxHtmlElement<HTMLOptionElement> {
    /**
     * Specifies that an option should be disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies a label for an option.
     */
    label?: string;

    /**
     * Specifies that an option should be pre-selected when the page loads.
     */
    selected?: Booleanish;

    /**
     * Specifies the value to be sent to a server when the form is submitted.
     */
    value?: string | ReadonlyArray<string> | number;
  }

  interface JsxPictureElement extends JsxHtmlElement<HTMLPictureElement> {
    // Picture element typically doesn't have any specific attributes
  }

  interface JsxPreElement extends JsxHtmlElement<HTMLPreElement> {
    // Pre element typically doesn't have any specific attributes in modern HTML
  }

  interface JsxProgressElement extends JsxHtmlElement<HTMLProgressElement> {
    /**
     * Specifies how much of the task has been completed.
     */
    value?: number | string;

    /**
     * Specifies how much work the task requires in total.
     */
    max?: number | string;
  }

  interface JsxQuoteElement extends JsxHtmlElement<HTMLQuoteElement> {
    /**
     * Specifies the source URL of the quote.
     */
    cite?: string;
  }

  interface JsxScriptElement extends JsxHtmlElement<HTMLScriptElement> {
    /**
     * Specifies that the script is executed asynchronously.
     */
    async?: Booleanish;

    /**
     * Specifies the character encoding used in an external script file.
     */
    charSet?: string;

    /**
     * Specifies that the script is executed when the page has finished parsing.
     */
    defer?: Booleanish;

    /**
     * Specifies the URL of an external script file.
     */
    src?: string;

    /**
     * Specifies the media type of the script.
     */
    type?: string;
  }

  interface JsxSelectElement extends JsxHtmlElement<HTMLSelectElement> {
    /**
     * Specifies that the select element should automatically get focus when the page loads.
     */
    autoFocus?: Booleanish;

    /**
     * Specifies that the select element should be disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies which form the select element belongs to.
     */
    form?: string;

    /**
     * Specifies that multiple options can be selected at once.
     */
    multiple?: Booleanish;

    /**
     * Specifies the name of the select element.
     */
    name?: string;

    /**
     * Specifies that the user is required to select a value before submitting the form.
     */
    required?: Booleanish;

    /**
     * Specifies the number of visible options in a drop-down list.
     */
    size?: number;
  }

  interface JsxSlotElement extends JsxHtmlElement<HTMLSlotElement> {
    /**
     * Specifies the name of the slot.
     */
    name?: string;
  }

  interface JsxSourceElement extends JsxHtmlElement<HTMLSourceElement> {
    /**
     * Specifies the URL of the media file.
     */
    src?: string;

    /**
     * Specifies the MIME type of the resource.
     */
    type?: string;

    /**
     * Specifies the intended media type of the source.
     */
    media?: string;

    /**
     * Specifies image sources for responsive images.
     */
    srcSet?: string;

    /**
     * Specifies which image size to use in different situations.
     */
    sizes?: string;
  }

  interface JsxSpanElement extends JsxHtmlElement<HTMLSpanElement> {
    // Span element typically doesn't have any specific attributes
  }

  interface JsxStyleElement extends JsxHtmlElement<HTMLStyleElement> {
    /**
     * Specifies that the styles only apply to the parent element and its child elements.
     */
    scoped?: Booleanish;

    /**
     * Specifies the media that the linked resource applies to.
     */
    media?: string;

    /**
     * Specifies the MIME type of the style sheet.
     */
    type?: string;
  }

  interface JsxTableElement extends JsxHtmlElement<HTMLTableElement> {
    // Table element typically doesn't have any specific attributes in modern HTML
  }

  interface JsxTableSectionElement
    extends JsxHtmlElement<HTMLTableSectionElement> {
    // TableSection element (thead, tbody, tfoot) typically doesn't have any specific attributes
  }

  interface JsxTableCellElement extends JsxHtmlElement<HTMLTableCellElement> {
    /**
     * Specifies the number of columns a cell should span.
     */
    colSpan?: number;

    /**
     * Specifies the number of rows a cell should span.
     */
    rowSpan?: number;

    /**
     * Specifies one or more header cells a cell is related to.
     */
    headers?: string;
  }

  interface JsxTemplateElement extends JsxHtmlElement<HTMLTemplateElement> {
    /**
     * Specifies the mode to use when creating a shadow root for the parent element.
     */
    shadowrootmode?: 'open' | 'closed';
  }

  interface JsxTextAreaElement extends JsxHtmlElement<HTMLTextAreaElement> {
    /**
     * Specifies that the textarea should automatically get focus when the page loads.
     */
    autoFocus?: Booleanish;

    /**
     * Specifies the visible width of a text area.
     */
    cols?: number;

    /**
     * Specifies that the textarea should be disabled.
     */
    disabled?: Booleanish;

    /**
     * Specifies which form the textarea belongs to.
     */
    form?: string;

    /**
     * Specifies the maximum number of characters allowed in the textarea.
     */
    maxlength?: number;

    /**
     * Specifies the minimum number of characters allowed in the textarea.
     */
    minlength?: number;

    /**
     * Specifies the name of the textarea.
     */
    name?: string;

    /**
     * Specifies a short hint that describes the expected value of the textarea.
     */
    placeholder?: string;

    /**
     * Specifies that the textarea is read-only.
     */
    readOnly?: Booleanish;

    /**
     * Specifies that the textarea must be filled out before submitting the form.
     */
    required?: Booleanish;

    /**
     * Specifies the visible number of lines in a text area.
     */
    rows?: number;

    /**
     * Specifies how the text in a text area is to be wrapped when submitted in a form.
     */
    wrap?: string;
  }

  interface JsxTimeElement extends JsxHtmlElement<HTMLTimeElement> {
    /**
     * Specifies the date and time.
     */
    dateTime?: string;
  }

  interface JsxTitleElement extends JsxHtmlElement<HTMLTitleElement> {
    // Title element typically doesn't have any specific attributes
  }

  interface JsxTableRowElement extends JsxHtmlElement<HTMLTableRowElement> {
    // TableRow element typically doesn't have any specific attributes in modern HTML
  }

  interface JsxTrackElement extends JsxHtmlElement<HTMLTrackElement> {
    /**
     * Specifies that the track is to be enabled if the user's preferences do not indicate that another track would be more appropriate.
     */
    default?: Booleanish;

    /**
     * Specifies the kind of text track.
     */
    kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';

    /**
     * Specifies the language of the track text data.
     */
    label?: string;

    /**
     * Specifies the language of the track text data.
     */
    src?: string;

    /**
     * Specifies the language of the track text data.
     */
    srcLang?: string;
  }

  interface JsxUListElement extends JsxHtmlElement<HTMLUListElement> {
    // UList element typically doesn't have any specific attributes
  }

  interface JsxVideoElement extends JsxHtmlElement<HTMLVideoElement> {
    /**
     * Specifies that the video will start playing as soon as it is ready.
     */
    autoPlay?: Booleanish;

    /**
     * Specifies that video controls should be displayed.
     */
    controls?: Booleanish;

    /**
     * Specifies the height of the video player.
     */
    height?: number | string;

    /**
     * Specifies that the video will start over again, every time it is finished.
     */
    loop?: Booleanish;

    /**
     * Specifies that the audio output of the video should be muted.
     */
    muted?: Booleanish;

    /**
     * Specifies an image to be shown while the video is downloading, or until the user hits the play button.
     */
    poster?: string;

    /**
     * Specifies if and how the author thinks the video should be loaded when the page loads.
     */
    preload?: 'auto' | 'metadata' | 'none';

    /**
     * Specifies the URL of the video file.
     */
    src?: string;

    /**
     * Specifies the width of the video player.
     */
    width?: number | string;
  }

  interface JsxHtmlDivElement extends JsxHtmlElement<HTMLDivElement> {}
  interface JsxHtmlHeadingElement extends JsxHtmlElement<HTMLHeadingElement> {}
  interface JsxHtmlOutputElement extends JsxHtmlElement<HTMLOutputElement> {}
  interface JsxHtmlParagraphElement
    extends JsxHtmlElement<HTMLParagraphElement> {}

  interface JsxHtmlElementMap {
    a: JsxHtmlAnchorElement;
    abbr: JsxHtmlElement<HTMLElement>;
    address: JsxHtmlElement<HTMLElement>;
    area: JsxAreaElement;
    article: JsxHtmlElement<HTMLElement>;
    aside: JsxHtmlElement<HTMLElement>;
    audio: JsxAudioElement;
    b: JsxHtmlElement<HTMLElement>;
    base: JsxBaseElement;
    bdi: JsxHtmlElement<HTMLElement>;
    bdo: JsxHtmlElement<HTMLElement>;
    blockquote: JsxQuoteElement;
    body: JsxBodyElement;
    br: JsxHtmlElement<HTMLElement>;
    button: JsxHtmlButtonElement;
    canvas: JsxCanvasElement;
    caption: JsxTableCaptionElement;
    cite: JsxHtmlElement<HTMLElement>;
    code: JsxHtmlElement<HTMLElement>;
    col: JsxHtmlElement<HTMLTableColElement>;
    colgroup: JsxHtmlElement<HTMLTableColElement>;
    data: JsxDataElement;
    datalist: JsxDataListElement;
    dd: JsxHtmlElement<HTMLElement>;
    del: JsxHtmlElement<HTMLElement>;
    details: JsxDetailsElement;
    dfn: JsxHtmlElement<HTMLElement>;
    dialog: JsxDialogElement;
    div: JsxHtmlDivElement;
    dl: JsxDListElement;
    dt: JsxHtmlElement<HTMLElement>;
    em: JsxHtmlElement<HTMLElement>;
    embed: JsxEmbedElement;
    fieldset: JsxFieldSetElement;
    figcaption: JsxHtmlElement<HTMLElement>;
    figure: JsxHtmlElement<HTMLElement>;
    footer: JsxHtmlElement<HTMLElement>;
    form: JsxFormElement;
    h1: JsxHtmlHeadingElement;
    h2: JsxHtmlHeadingElement;
    h3: JsxHtmlHeadingElement;
    h4: JsxHtmlHeadingElement;
    h5: JsxHtmlHeadingElement;
    h6: JsxHtmlHeadingElement;
    head: JsxHeadElement;
    header: JsxHtmlElement<HTMLElement>;
    hgroup: JsxHtmlElement<HTMLElement>;
    hr: JsxHRElement;
    html: JsxHtmlElement<HTMLHtmlElement>;
    i: JsxHtmlElement<HTMLElement>;
    iframe: JsxIFrameElement;
    img: JsxImageElement;
    input: JsxInputElement;
    ins: JsxHtmlElement<HTMLElement>;
    kbd: JsxHtmlElement<HTMLElement>;
    label: JsxLabelElement;
    legend: JsxLegendElement;
    li: JsxLIElement;
    link: JsxLinkElement;
    main: JsxHtmlElement<HTMLElement>;
    map: JsxMapElement;
    mark: JsxHtmlElement<HTMLElement>;
    menu: JsxMenuElement;
    meta: JsxMetaElement;
    meter: JsxMeterElement;
    nav: JsxHtmlElement<HTMLElement>;
    noscript: JsxHtmlElement<HTMLElement>;
    object: JsxObjectElement;
    ol: JsxOListElement;
    optgroup: JsxOptGroupElement;
    option: JsxOptionElement;
    output: JsxHtmlOutputElement;
    p: JsxHtmlParagraphElement;
    picture: JsxPictureElement;
    pre: JsxPreElement;
    progress: JsxProgressElement;
    q: JsxQuoteElement;
    rp: JsxHtmlElement<HTMLElement>;
    rt: JsxHtmlElement<HTMLElement>;
    ruby: JsxHtmlElement<HTMLElement>;
    s: JsxHtmlElement<HTMLElement>;
    samp: JsxHtmlElement<HTMLElement>;
    script: JsxScriptElement;
    section: JsxHtmlElement<HTMLElement>;
    select: JsxSelectElement;
    slot: JsxSlotElement;
    small: JsxHtmlElement<HTMLElement>;
    source: JsxSourceElement;
    span: JsxSpanElement;
    strong: JsxHtmlElement<HTMLElement>;
    style: JsxStyleElement;
    sub: JsxHtmlElement<HTMLElement>;
    summary: JsxHtmlElement<HTMLElement>;
    sup: JsxHtmlElement<HTMLElement>;
    table: JsxTableElement;
    tbody: JsxTableSectionElement;
    td: JsxTableCellElement;
    template: JsxTemplateElement;
    textarea: JsxTextAreaElement;
    tfoot: JsxTableSectionElement;
    th: JsxTableCellElement;
    thead: JsxTableSectionElement;
    time: JsxTimeElement;
    title: JsxTitleElement;
    tr: JsxTableRowElement;
    track: JsxTrackElement;
    u: JsxHtmlElement<HTMLElement>;
    ul: JsxUListElement;
    var: JsxHtmlElement<HTMLElement>;
    video: JsxVideoElement;
    wbr: JsxHtmlElement<HTMLElement>;

    // Deprecated elements (still included for completeness)
    acronym: JsxHtmlElement<HTMLElement>;
    applet: JsxHtmlElement<HTMLElement>;
    basefont: JsxHtmlElement<HTMLElement>;
    bgsound: JsxHtmlElement<HTMLElement>;
    big: JsxHtmlElement<HTMLElement>;
    blink: JsxHtmlElement<HTMLElement>;
    center: JsxHtmlElement<HTMLElement>;
    command: JsxHtmlElement<HTMLElement>;
    content: JsxHtmlElement<HTMLElement>;
    dir: JsxHtmlElement<HTMLElement>;
    element: JsxHtmlElement<HTMLElement>;
    font: JsxHtmlElement<HTMLElement>;
    frame: JsxHtmlElement<HTMLElement>;
    frameset: JsxHtmlElement<HTMLElement>;
    image: JsxHtmlElement<HTMLElement>;
    isindex: JsxHtmlElement<HTMLElement>;
    keygen: JsxHtmlElement<HTMLElement>;
    listing: JsxHtmlElement<HTMLElement>;
    marquee: JsxHtmlElement<HTMLElement>;
    menuitem: JsxHtmlElement<HTMLElement>;
    multicol: JsxHtmlElement<HTMLElement>;
    nextid: JsxHtmlElement<HTMLElement>;
    nobr: JsxHtmlElement<HTMLElement>;
    noembed: JsxHtmlElement<HTMLElement>;
    noframes: JsxHtmlElement<HTMLElement>;
    plaintext: JsxHtmlElement<HTMLElement>;
    shadow: JsxHtmlElement<HTMLElement>;
    spacer: JsxHtmlElement<HTMLElement>;
    strike: JsxHtmlElement<HTMLElement>;
    tt: JsxHtmlElement<HTMLElement>;
    xmp: JsxHtmlElement<HTMLElement>;
  }

  /** Interface for common SVG presentation attributes */
  interface SVGPresentationAttributes {
    /** Specifies how an object is aligned along the font baseline */
    alignmentBaseline?:
      | 'auto'
      | 'baseline'
      | 'before-edge'
      | 'text-before-edge'
      | 'middle'
      | 'central'
      | 'after-edge'
      | 'text-after-edge'
      | 'ideographic'
      | 'alphabetic'
      | 'hanging'
      | 'mathematical'
      | 'inherit';
    /** Specifies the base color of the element */
    baselineShift?: 'auto' | 'baseline' | 'super' | 'sub' | string | number;
    /** Specifies the color to paint the element */
    color?: string;
    /** Specifies the color interpolation method to use */
    colorInterpolation?: 'auto' | 'sRGB' | 'linearRGB';
    /** Specifies the color interpolation method to use for filter effects */
    colorInterpolationFilters?: 'auto' | 'sRGB' | 'linearRGB';
    /** Specifies the color to paint the interior of the element */
    fill?: string;
    /** Specifies the opacity of the painting operation used to paint the interior of the element */
    fillOpacity?: number | string;
    /** Specifies the paint server to use to paint the interior of the element */
    fillRule?: 'nonzero' | 'evenodd';
    /** Specifies the font family to use */
    fontFamily?: string;
    /** Specifies the font size to use */
    fontSize?: number | string;
    /** Specifies the font style to use */
    fontStyle?: 'normal' | 'italic' | 'oblique';
    /** Specifies the font weight to use */
    fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
    /** Specifies the color to paint along the outline of the element */
    stroke?: string;
    /** Specifies the width of the stroke on the element */
    strokeWidth?: number | string;
    /** Specifies the opacity of the painting operation used to stroke the element */
    strokeOpacity?: number | string;
    /** Defines a mask to be applied to the element. */
    mask?: string;
  }

  /** Interface for SVG core attributes */
  interface SVGCoreAttributes<E = SVGElement>
    extends JSXGlobalAttributes,
      JsxAriaAttributes,
      JsxGlobalEventHandlers<E>,
      DatasetAttributes,
      JsxNativeProps {}

  interface JsxSVGElement
    extends SVGCoreAttributes<SVGSVGElement>,
      SVGPresentationAttributes {
    /** Specifies the width of the SVG viewport */
    width?: number | string;
    /** Specifies the height of the SVG viewport */
    height?: number | string;
    /** Specifies how the SVG fragment should be displayed */
    viewBox?: string;
    /** Specifies the default language to use for the SVG fragment */
    xmlLang?: string;
  }

  interface JsxSVGAElement
    extends SVGCoreAttributes<SVGAElement>,
      SVGPresentationAttributes {
    /** Specifies the URL to link to */
    href?: string;
    /** Specifies the target window or frame for the linked URL */
    target?: string;
  }

  interface JsxSVGAnimateElement extends SVGCoreAttributes<SVGAnimateElement> {
    /** Specifies the name of the attribute to animate */
    attributeName?: string;
    /** Specifies the starting value of the animation */
    from?: string | number;
    /** Specifies the ending value of the animation */
    to?: string | number;
    /** Specifies the duration of the animation */
    dur?: string;
    /** Specifies how many times the animation should repeat */
    repeatCount?: number | 'indefinite';
  }

  interface JsxSVGAnimateMotionElement
    extends SVGCoreAttributes<SVGAnimateMotionElement> {
    /** Specifies the path the animation will follow */
    path?: string;
    /** Specifies the duration of the animation */
    dur?: string;
    /** Specifies how many times the animation should repeat */
    repeatCount?: number | 'indefinite';
  }

  interface JsxSVGAnimateTransformElement
    extends SVGCoreAttributes<SVGAnimateTransformElement> {
    /** Specifies the type of transformation */
    type?: 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY';
    /** Specifies the starting value of the animation */
    from?: string;
    /** Specifies the ending value of the animation */
    to?: string;
    /** Specifies the duration of the animation */
    dur?: string;
    /** Specifies how many times the animation should repeat */
    repeatCount?: number | 'indefinite';
  }

  interface JsxSVGCircleElement
    extends SVGCoreAttributes<SVGCircleElement>,
      SVGPresentationAttributes {
    /** Specifies the x-coordinate of the center of the circle */
    cx?: number | string;
    /** Specifies the y-coordinate of the center of the circle */
    cy?: number | string;
    /** Specifies the radius of the circle */
    r?: number | string;
  }

  interface JsxSVGClipPathElement
    extends SVGCoreAttributes<SVGClipPathElement> {
    /** Specifies the coordinate system for the contents of the <clipPath> element */
    clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }

  interface JsxSVGDefsElement extends SVGCoreAttributes<SVGDefsElement> {}

  interface JsxSVGDescElement extends SVGCoreAttributes<SVGDescElement> {}

  interface JsxSVGEllipseElement
    extends SVGCoreAttributes<SVGEllipseElement>,
      SVGPresentationAttributes {
    /** Specifies the x-coordinate of the center of the ellipse */
    cx?: number | string;
    /** Specifies the y-coordinate of the center of the ellipse */
    cy?: number | string;
    /** Specifies the x-radius of the ellipse */
    rx?: number | string;
    /** Specifies the y-radius of the ellipse */
    ry?: number | string;
  }

  interface JsxSVGFEBlendElement extends SVGCoreAttributes<SVGFEBlendElement> {
    /** Specifies the first input for the given filter primitive */
    in?: string;
    /** Specifies the second input for the given filter primitive */
    in2?: string;
    /** Specifies the blending mode */
    mode?: 'normal' | 'multiply' | 'screen' | 'darken' | 'lighten';
  }

  interface JsxSVGFEColorMatrixElement
    extends SVGCoreAttributes<SVGFEColorMatrixElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the type of color matrix operation */
    type?: 'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha';
    /** Specifies the values for the color matrix */
    values?: string;
  }

  interface JsxSVGFEComponentTransferElement
    extends SVGCoreAttributes<SVGFEComponentTransferElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
  }

  interface JsxSVGFECompositeElement
    extends SVGCoreAttributes<SVGFECompositeElement> {
    /** Specifies the first input for the given filter primitive */
    in?: string;
    /** Specifies the second input for the given filter primitive */
    in2?: string;
    /** Specifies the compositing operation to perform */
    operator?: 'over' | 'in' | 'out' | 'atop' | 'xor' | 'arithmetic';
    /** Specifies the k1 value for arithmetic operation */
    k1?: number;
    /** Specifies the k2 value for arithmetic operation */
    k2?: number;
    /** Specifies the k3 value for arithmetic operation */
    k3?: number;
    /** Specifies the k4 value for arithmetic operation */
    k4?: number;
  }

  interface JsxSVGFEConvolveMatrixElement
    extends SVGCoreAttributes<SVGFEConvolveMatrixElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the values for the convolution matrix */
    kernelMatrix?: string;
    /** Specifies the number of columns in the matrix */
    order?: number | string;
  }

  interface JsxSVGFEDiffuseLightingElement
    extends SVGCoreAttributes<SVGFEDiffuseLightingElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the surface scale factor */
    surfaceScale?: number;
    /** Specifies the diffuse constant */
    diffuseConstant?: number;
  }

  interface JsxSVGFEDisplacementMapElement
    extends SVGCoreAttributes<SVGFEDisplacementMapElement> {
    /** Specifies the first input for the given filter primitive */
    in?: string;
    /** Specifies the second input for the given filter primitive */
    in2?: string;
    /** Specifies the scale factor */
    scale?: number;
    /** Specifies which color channel to use to displace the pixels along the x-axis */
    xChannelSelector?: 'R' | 'G' | 'B' | 'A';
    /** Specifies which color channel to use to displace the pixels along the y-axis */
    yChannelSelector?: 'R' | 'G' | 'B' | 'A';
  }

  interface JsxSVGFEDistantLightElement
    extends SVGCoreAttributes<SVGFEDistantLightElement> {
    /** Specifies the azimuth of the light source */
    azimuth?: number;
    /** Specifies the elevation of the light source */
    elevation?: number;
  }

  interface JsxSVGFEDropShadowElement
    extends SVGCoreAttributes<SVGFEDropShadowElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the standard deviation for the blur operation */
    stdDeviation?: number | string;
    /** Specifies the x offset of the drop shadow */
    dx?: number;
    /** Specifies the y offset of the drop shadow */
    dy?: number;
  }

  interface JsxSVGFEFloodElement
    extends SVGCoreAttributes<SVGFEFloodElement>,
      SVGPresentationAttributes {
    /** Specifies the flood color */
    floodColor?: string;
    /** Specifies the flood opacity */
    floodOpacity?: number | string;
  }

  interface JsxSVGFEFuncAElement extends SVGCoreAttributes<SVGFEFuncAElement> {
    /** Specifies the type of component transfer function */
    type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  }

  interface JsxSVGFEFuncBElement extends SVGCoreAttributes<SVGFEFuncBElement> {
    /** Specifies the type of component transfer function */
    type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  }

  interface JsxSVGFEFuncGElement extends SVGCoreAttributes<SVGFEFuncGElement> {
    /** Specifies the type of component transfer function */
    type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  }

  interface JsxSVGFEFuncRElement extends SVGCoreAttributes<SVGFEFuncRElement> {
    /** Specifies the type of component transfer function */
    type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  }

  interface JsxSVGFEGaussianBlurElement
    extends SVGCoreAttributes<SVGFEGaussianBlurElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the standard deviation for the blur operation */
    stdDeviation?: number | string;
  }

  interface JsxSVGFEImageElement
    extends SVGCoreAttributes<SVGFEImageElement>,
      SVGPresentationAttributes {
    /** Specifies the URL of the image file */
    href?: string;
    /** Specifies how to align the image */
    preserveAspectRatio?: string;
  }

  interface JsxSVGFEMergeElement extends SVGCoreAttributes<SVGFEMergeElement> {}

  interface JsxSVGFEMergeNodeElement
    extends SVGCoreAttributes<SVGFEMergeNodeElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
  }

  interface JsxSVGFEMorphologyElement
    extends SVGCoreAttributes<SVGFEMorphologyElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the morphology operation to perform */
    operator?: 'erode' | 'dilate';
    /** Specifies the radius (or radii) for the operation */
    radius?: number | string;
  }

  interface JsxSVGFEOffsetElement
    extends SVGCoreAttributes<SVGFEOffsetElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the amount to offset the input graphic along the x-axis */
    dx?: number | string;
    /** Specifies the amount to offset the input graphic along the y-axis */
    dy?: number | string;
  }

  interface JsxSVGFEPointLightElement
    extends SVGCoreAttributes<SVGFEPointLightElement> {
    /** Specifies the x location of the light source */
    x?: number;
    /** Specifies the y location of the light source */
    y?: number;
    /** Specifies the z location of the light source */
    z?: number;
  }

  interface JsxSVGFESpecularLightingElement
    extends SVGCoreAttributes<SVGFESpecularLightingElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
    /** Specifies the surface scale factor */
    surfaceScale?: number;
    /** Specifies the specular constant */
    specularConstant?: number;
    /** Specifies the specular exponent */
    specularExponent?: number;
  }

  interface JsxSVGFESpotLightElement
    extends SVGCoreAttributes<SVGFESpotLightElement> {
    /** Specifies the x location of the light source */
    x?: number;
    /** Specifies the y location of the light source */
    y?: number;
    /** Specifies the z location of the light source */
    z?: number;
    /** Specifies the x point at which the light source is pointing */
    pointsAtX?: number;
    /** Specifies the y point at which the light source is pointing */
    pointsAtY?: number;
    /** Specifies the z point at which the light source is pointing */
    pointsAtZ?: number;
    /** Specifies the concentration of the light */
    specularExponent?: number;
    /** Specifies the limiting cone angle of the light source */
    limitingConeAngle?: number;
  }

  interface JsxSVGFETileElement extends SVGCoreAttributes<SVGFETileElement> {
    /** Specifies the input for the given filter primitive */
    in?: string;
  }

  interface JsxSVGFETurbulenceElement
    extends SVGCoreAttributes<SVGFETurbulenceElement> {
    /** Specifies the base frequency for the noise function */
    baseFrequency?: number | string;
    /** Specifies the number of octaves for the noise function */
    numOctaves?: number;
    /** Specifies the seed for the pseudo random number generator */
    seed?: number;
    /** Specifies whether the filter primitive should perform a noise or turbulence function */
    stitchTiles?: 'stitch' | 'noStitch';
    /** Specifies the type of turbulence function */
    type?: 'fractalNoise' | 'turbulence';
  }

  interface JsxSVGFilterElement extends SVGCoreAttributes<SVGFilterElement> {
    /** Specifies the coordinate system for the filter */
    filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    /** Specifies the coordinate system for the filter primitives */
    primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    /** Specifies the x coordinate of the filter region */
    x?: number | string;
    /** Specifies the y coordinate of the filter region */
    y?: number | string;
    /** Specifies the width of the filter region */
    width?: number | string;
    /** Specifies the height of the filter region */
    height?: number | string;
  }

  interface JsxSVGForeignObjectElement
    extends SVGCoreAttributes<SVGForeignObjectElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the foreign object */
    x?: number | string;
    /** Specifies the y coordinate of the foreign object */
    y?: number | string;
    /** Specifies the width of the foreign object */
    width?: number | string;
    /** Specifies the height of the foreign object */
    height?: number | string;
  }

  interface JsxSVGGElement
    extends SVGCoreAttributes<SVGGElement>,
      SVGPresentationAttributes {
    /** Defines a mask to be applied to the element. */
    mask?: string;
  }

  interface JsxSVGImageElement
    extends SVGCoreAttributes<SVGImageElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the image */
    x?: number | string;
    /** Specifies the y coordinate of the image */
    y?: number | string;
    /** Specifies the width of the image */
    width?: number | string;
    /** Specifies the height of the image */
    height?: number | string;
    /** Specifies the URL of the image */
    href?: string;
    /** Specifies how to align the image */
    preserveAspectRatio?: string;
  }

  interface JsxSVGLineElement
    extends SVGCoreAttributes<SVGLineElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the start of the line */
    x1?: number | string;
    /** Specifies the y coordinate of the start of the line */
    y1?: number | string;
    /** Specifies the x coordinate of the end of the line */
    x2?: number | string;
    /** Specifies the y coordinate of the end of the line */
    y2?: number | string;
  }

  interface JsxSVGLinearGradientElement
    extends SVGCoreAttributes<SVGLinearGradientElement> {
    /** Specifies the x coordinate of the start point of the gradient vector */
    x1?: number | string;
    /** Specifies the y coordinate of the start point of the gradient vector */
    y1?: number | string;
    /** Specifies the x coordinate of the end point of the gradient vector */
    x2?: number | string;
    /** Specifies the y coordinate of the end point of the gradient vector */
    y2?: number | string;
    /** Specifies the coordinate system for attributes x1, y1, x2, y2 */
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }

  interface JsxSVGMarkerElement
    extends SVGCoreAttributes<SVGMarkerElement>,
      SVGPresentationAttributes {
    /** Specifies the width of the marker */
    markerWidth?: number | string;
    /** Specifies the height of the marker */
    markerHeight?: number | string;
    /** Specifies the coordinate system for the attributes markerWidth, markerHeight, and the contents of the <marker> */
    markerUnits?: 'strokeWidth' | 'userSpaceOnUse';
    /** Specifies the orientation of the marker */
    orient?: 'auto' | 'auto-start-reverse' | number | string;
    /** Specifies the x coordinate of the reference point */
    refX?: number | string;
    /** Specifies the y coordinate of the reference point */
    refY?: number | string;
  }

  interface JsxSVGMaskElement
    extends SVGCoreAttributes<SVGMaskElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the mask */
    x?: number | string;
    /** Specifies the y coordinate of the mask */
    y?: number | string;
    /** Specifies the width of the mask */
    width?: number | string;
    /** Specifies the height of the mask */
    height?: number | string;
    /** Specifies the coordinate system for attributes x, y, width, height */
    maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    /** Specifies the coordinate system for the contents of the <mask> */
    maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }

  interface JsxSVGMetadataElement
    extends SVGCoreAttributes<SVGMetadataElement> {}

  interface JsxSVGMPathElement extends SVGCoreAttributes<SVGMPathElement> {
    /** Specifies a path to follow */
    href?: string;
  }

  interface JsxSVGPathElement
    extends SVGCoreAttributes<SVGPathElement>,
      SVGPresentationAttributes {
    /** Specifies the path to be drawn */
    d?: string;
    /** Specifies the path length for path animation */
    pathLength?: number;
  }

  interface JsxSVGPatternElement
    extends SVGCoreAttributes<SVGPatternElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the pattern tile */
    x?: number | string;
    /** Specifies the y coordinate of the pattern tile */
    y?: number | string;
    /** Specifies the width of the pattern tile */
    width?: number | string;
    /** Specifies the height of the pattern tile */
    height?: number | string;
    /** Specifies the coordinate system for attributes x, y, width, height */
    patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    /** Specifies the coordinate system for the contents of the <pattern> */
    patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }

  interface JsxSVGPolygonElement
    extends SVGCoreAttributes<SVGPolygonElement>,
      SVGPresentationAttributes {
    /** Specifies the points that make up the polygon */
    points?: string;
  }

  interface JsxSVGPolylineElement
    extends SVGCoreAttributes<SVGPolylineElement>,
      SVGPresentationAttributes {
    /** Specifies the points that make up the polyline */
    points?: string;
  }

  interface JsxSVGRadialGradientElement
    extends SVGCoreAttributes<SVGRadialGradientElement> {
    /** Specifies the x coordinate of the end circle of the radial gradient */
    cx?: number | string;
    /** Specifies the y coordinate of the end circle of the radial gradient */
    cy?: number | string;
    /** Specifies the radius of the end circle of the radial gradient */
    r?: number | string;
    /** Specifies the x coordinate of the start circle of the radial gradient */
    fx?: number | string;
    /** Specifies the y coordinate of the start circle of the radial gradient */
    fy?: number | string;
    /** Specifies the radius of the start circle of the radial gradient */
    fr?: number | string;
    /** Specifies the coordinate system for attributes cx, cy, r, fx, fy, fr */
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  }

  interface JsxSVGRectElement
    extends SVGCoreAttributes<SVGRectElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the rectangle */
    x?: number | string;
    /** Specifies the y coordinate of the rectangle */
    y?: number | string;
    /** Specifies the width of the rectangle */
    width?: number | string;
    /** Specifies the height of the rectangle */
    height?: number | string;
    /** Specifies the horizontal corner radius of the rectangle */
    rx?: number | string;
    /** Specifies the vertical corner radius of the rectangle */
    ry?: number | string;
    /** Specifies the transformation to apply to the element. */
    transform?: string;
  }

  interface JsxSVGStopElement
    extends SVGCoreAttributes<SVGStopElement>,
      SVGPresentationAttributes {
    /** Specifies where the gradient stop is placed */
    offset?: number | string;
    /** Specifies the color of the gradient stop */
    stopColor?: string;
    /** Specifies the opacity of the gradient stop */
    stopOpacity?: number | string;
  }

  interface JsxSVGSwitchElement
    extends SVGCoreAttributes<SVGSwitchElement>,
      SVGPresentationAttributes {}

  interface JsxSVGSymbolElement
    extends SVGCoreAttributes<SVGSymbolElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the symbol */
    x?: number | string;
    /** Specifies the y coordinate of the symbol */
    y?: number | string;
    /** Specifies the width of the symbol */
    width?: number | string;
    /** Specifies the height of the symbol */
    height?: number | string;
    /** Specifies how the symbol should be fitted to the viewport */
    preserveAspectRatio?: string;
    /** Specifies the viewbox of the symbol */
    viewBox?: string;
  }

  interface JsxSVGTextElement
    extends SVGCoreAttributes<SVGTextElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the starting point of the text */
    x?: number | string;
    /** Specifies the y coordinate of the starting point of the text */
    y?: number | string;
    /** Shifts the text position horizontally from a previous text element */
    dx?: number | string;
    /** Shifts the text position vertically from a previous text element */
    dy?: number | string;
    /** Rotates the text */
    rotate?: number | string;
    /** Specifies the length of the text */
    textLength?: number | string;
    /** Specifies how the text should be stretched or compressed to fit the specified length */
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
  }

  interface JsxSVGTextPathElement
    extends SVGCoreAttributes<SVGTextPathElement>,
      SVGPresentationAttributes {
    /** Specifies the path the text should follow */
    href?: string;
    /** Specifies where on the path the text should begin */
    startOffset?: number | string;
    /** Specifies how the text should be aligned relative to the path */
    method?: 'align' | 'stretch';
    /** Specifies how the text should be spaced relative to the path */
    spacing?: 'auto' | 'exact';
  }

  interface JsxSVGTSpanElement
    extends SVGCoreAttributes<SVGTSpanElement>,
      SVGPresentationAttributes {
    /** Specifies the x coordinate of the starting point of the text */
    x?: number | string;
    /** Specifies the y coordinate of the starting point of the text */
    y?: number | string;
    /** Shifts the text position horizontally from a previous text element */
    dx?: number | string;
    /** Shifts the text position vertically from a previous text element */
    dy?: number | string;
    /** Rotates the text */
    rotate?: number | string;
    /** Specifies the length of the text */
    textLength?: number | string;
    /** Specifies how the text should be stretched or compressed to fit the specified length */
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
  }

  interface JsxSVGUseElement extends SVGCoreAttributes<SVGUseElement> {}

  interface JsxSVGViewElement extends SVGCoreAttributes<SVGViewElement> {}

  interface JsxSvgElementMap {
    svg: JsxSVGElement;
    a: JsxSVGAElement;
    animate: JsxSVGAnimateElement;
    animateMotion: JsxSVGAnimateMotionElement;
    animateTransform: JsxSVGAnimateTransformElement;
    circle: JsxSVGCircleElement;
    clipPath: JsxSVGClipPathElement;
    defs: JsxSVGDefsElement;
    desc: JsxSVGDescElement;
    ellipse: JsxSVGEllipseElement;
    feBlend: JsxSVGFEBlendElement;
    feColorMatrix: JsxSVGFEColorMatrixElement;
    feComponentTransfer: JsxSVGFEComponentTransferElement;
    feComposite: JsxSVGFECompositeElement;
    feConvolveMatrix: JsxSVGFEConvolveMatrixElement;
    feDiffuseLighting: JsxSVGFEDiffuseLightingElement;
    feDisplacementMap: JsxSVGFEDisplacementMapElement;
    feDistantLight: JsxSVGFEDistantLightElement;
    feDropShadow: JsxSVGFEDropShadowElement;
    feFlood: JsxSVGFEFloodElement;
    feFuncA: JsxSVGFEFuncAElement;
    feFuncB: JsxSVGFEFuncBElement;
    feFuncG: JsxSVGFEFuncGElement;
    feFuncR: JsxSVGFEFuncRElement;
    feGaussianBlur: JsxSVGFEGaussianBlurElement;
    feImage: JsxSVGFEImageElement;
    feMerge: JsxSVGFEMergeElement;
    feMergeNode: JsxSVGFEMergeNodeElement;
    feMorphology: JsxSVGFEMorphologyElement;
    feOffset: JsxSVGFEOffsetElement;
    fePointLight: JsxSVGFEPointLightElement;
    feSpecularLighting: JsxSVGFESpecularLightingElement;
    feSpotLight: JsxSVGFESpotLightElement;
    feTile: JsxSVGFETileElement;
    feTurbulence: JsxSVGFETurbulenceElement;
    filter: JsxSVGFilterElement;
    foreignObject: JsxSVGForeignObjectElement;
    g: JsxSVGGElement;
    image: JsxSVGImageElement;
    line: JsxSVGLineElement;
    linearGradient: JsxSVGLinearGradientElement;
    marker: JsxSVGMarkerElement;
    mask: JsxSVGMaskElement;
    metadata: JsxSVGMetadataElement;
    mpath: JsxSVGMPathElement;
    path: JsxSVGPathElement;
    pattern: JsxSVGPatternElement;
    polygon: JsxSVGPolygonElement;
    polyline: JsxSVGPolylineElement;
    radialGradient: JsxSVGRadialGradientElement;
    rect: JsxSVGRectElement;
    stop: JsxSVGStopElement;
    switch: JsxSVGSwitchElement;
    symbol: JsxSVGSymbolElement;
    text: JsxSVGTextElement;
    textPath: JsxSVGTextPathElement;
    tspan: JsxSVGTSpanElement;
    use: JsxSVGUseElement;
    view: JsxSVGViewElement;
  }

  type ValueOrCell<T> = T | import('@adbl/cells').Cell<T>;

  type Container<ElementAttributes extends object> = {
    [attribute in keyof ElementAttributes]: ValueOrCell<
      ElementAttributes[attribute]
    >;
  };

  type ElementTypes<T extends keyof IntrinsicElementsBase> = Container<
    IntrinsicElementsBase[T]
  >;
  type IntrinsicElementsBase = JsxHtmlElementMap & JsxSvgElementMap;
  type IntrinsicElementsInner = {
    [key in keyof IntrinsicElementsBase]: ElementTypes<key>;
  } & Record<`${string}-${string}`, ElementTypes<'div'>>;

  export interface IntrinsicElements extends IntrinsicElementsInner {}

  type NodeLike = globalThis.Node | import('../static/v-dom.js').VNode;

  type Node =
    | NodeLike
    | PropertyKey
    | Promise<
        | NodeLike
        | NodeLike[]
        | PropertyKey
        | null
        | undefined
        // biome-ignore lint/suspicious/noConfusingVoidType:
        | void
      >;
  export type Template =
    | Node
    | Node[]
    | undefined
    | void
    | null
    // biome-ignore lint/suspicious/noConfusingVoidType:
    | Promise<Node | Node[] | void | undefined | null>;

  export type Element = Template;
}
