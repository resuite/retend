/** @import { SourceCell } from 'retend' */
/** @import { JSX } from 'retend/jsx-runtime' */

import { Cell, useObserver } from 'retend';

/**
 * A reactive input component with two-way data binding support for various HTML input types.
 *
 * @template {JSX.InputTypeHTMLAttribute} T - The input type (extends JSX.InputTypeHTMLAttribute)
 * @param {InputProps<T>} props
 *
 *
 * @example
 * // Text input
 * const text = Cell.source('initial value');
 * <Input type="text" model={text} />
 *
 * @example
 * // Checkbox
 * const checked = Cell.source(false);
 * <Input type="checkbox" model={checked} />
 *
 * @example
 * // File input
 * const files = Cell.source<File[]>([]);
 * <Input type="file" model={files} multiple />
 */
export function Input(props) {
  const { model, ref = Cell.source(null), ...rest } = props;
  const observer = useObserver();
  // It is derived to prevent explicit binding to the
  // source model, which could have led to memory
  // leaks.
  const derivedModel = Cell.derived(() => {
    return model?.get();
  });

  // From model to input.
  derivedModel.listen((value) => {
    const input = ref.get();
    if (!value || !input) return;

    const { type } = input;
    if (type === 'file') {
      const files = /** @type {File[]} */ (value);
      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }
      input.files = dataTransfer.files;
    } else {
      input.value = String(value);
    }
  });

  observer.onConnected(ref, (input) => {
    // Propagate initial values.
    if (model) {
      const modelValue = model.get();
      if (modelValue) {
        input.value = String(modelValue);
      } else {
        model.set(getValueFromInput(input));
      }
    }

    /** @param {Event} event */
    const inputToModelBinding = (event) => {
      const input = /** @type {HTMLInputElement} */ (event.currentTarget);
      const value = /** @type {JSX.InputTypeToValueMap[T]} */ (
        getValueFromInput(input)
      );
      if (model) {
        model.set(value);
      }
    };

    input.addEventListener('input', inputToModelBinding);

    return () => {
      input.removeEventListener('input', inputToModelBinding);
    };
  });

  return <input {...rest} ref={ref} />;
}

/**
 * @typedef {JSX.IntrinsicElements['input']} IntrinsicInputProps
 */

/**
 * @template {JSX.InputTypeHTMLAttribute} T - The input type (extends JSX.InputTypeHTMLAttribute)
 *
 * @typedef InputAdditionalProps
 * @property {T} type - The HTML input type
 *
 * @property {SourceCell<HTMLInputElement | null>} [ref]
 * Optional reference to the input element
 *
 * @property {SourceCell<JSX.InputTypeToValueMap[T]>} [model] -
 * Reactive model for two-way data binding
 * The value type depends on the input type:
 * - checkbox/radio: boolean
 * - file: File[]
 * - number/range: number
 * - date/datetime-local: Date
 *
 * All other input types accept string values.
 *
 * @property {T} [type]
 * The HTML input type
 */

/**
 * @template {JSX.InputTypeHTMLAttribute} T - The input type (extends JSX.InputTypeHTMLAttribute)
 * @typedef {Omit<IntrinsicInputProps, 'type' | 'ref'> & InputAdditionalProps<T>} InputProps
 */

/**
 * Extracts the appropriate value from an input element based on its type
 *
 * @template {JSX.InputTypeHTMLAttribute} T - The input type (extends JSX.InputTypeHTMLAttribute)
 * @param {HTMLInputElement} element - The input element
 * @returns {JSX.InputTypeToValueMap[T]} The extracted value
 *
 * @private
 */
function getValueFromInput(element) {
  /**
   * @typedef {JSX.InputTypeToValueMap[T]} Value
   */

  const { type, value } = element;

  switch (/** @type {T} **/ (type)) {
    case 'checkbox':
    case 'radio':
      return /** @type {Value} */ (element.checked);
    case 'file':
      return /** @type {Value} */ (Array.from(element.files ?? []));
    case 'number':
    case 'range':
      return /** @type {Value} */ (Number(value));
    case 'date':
    case 'datetime-local':
      return /** @type {Value} */ (new Date(value));
    default:
      return /** @type {Value} */ (value);
  }
}
