import { For } from 'retend';

import classes from '../styles/Panel.module.css';

interface InspectorPropValueProps {
  value: unknown;
}

export function InspectorPropValue(props: InspectorPropValueProps) {
  const { value } = props;
  const rawType = Object.prototype.toString.call(value);

  if (value === null) {
    return <span class={[classes.propValue, classes.propNull]}>null</span>;
  }

  if (value === undefined) {
    return (
      <span class={[classes.propValue, classes.propUndefined]}>undefined</span>
    );
  }

  if (rawType === '[object String]') {
    return (
      <span class={[classes.propValue, classes.propString]}>
        "{String(value)}"
      </span>
    );
  }

  if (rawType === '[object Number]') {
    return <span class={[classes.propValue, classes.propNumber]}>{value}</span>;
  }

  if (rawType === '[object Boolean]') {
    return (
      <span class={[classes.propValue, classes.propBoolean]}>
        {String(value)}
      </span>
    );
  }

  if (rawType === '[object BigInt]') {
    return (
      <span class={[classes.propValue, classes.propBigint]}>
        {String(value)}n
      </span>
    );
  }

  if (rawType === '[object Symbol]') {
    return (
      <span class={[classes.propValue, classes.propSymbol]}>
        {String(value)}
      </span>
    );
  }

  if (typeof value === 'function') {
    const fnNameValue = Reflect.get(value, 'name');
    let fnName = '';
    if (Object.prototype.toString.call(fnNameValue) === '[object String]') {
      fnName = String(fnNameValue);
    }

    if (fnName.startsWith('{') && fnName.endsWith('}')) {
      const templateName = fnName.slice(1, fnName.length - 1).trim();
      let jsxTemplate = templateName;
      if (templateName === '') {
        jsxTemplate = '...';
      }
      return (
        <span class={[classes.propValue, classes.propJsxTemplate]}>
          {'<'}
          {jsxTemplate}
          {' />'}
        </span>
      );
    }

    let fnLabel = 'f ()';
    if (fnName !== '') {
      fnLabel = `f ${fnName}()`;
    }
    return (
      <span class={[classes.propValue, classes.propFunction]}>{fnLabel}</span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <details class={classes.propExpandable}>
        <summary
          class={[classes.propValue, classes.propArray, classes.propSummary]}
        >
          Array({value.length})
        </summary>
        <div class={classes.propNested}>
          <table class={classes.propsTable}>
            <tbody>
              {For(value, (item, index) => (
                <tr class={classes.propsRow}>
                  <th class={classes.propNestedKey}>{String(index)}</th>
                  <td class={classes.propValueCell}>
                    <InspectorPropValue value={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    );
  }

  let constructorName = 'Object';
  const constructorValue = Reflect.get(value as object, 'constructor');
  if (constructorValue) {
    const constructorNameValue = Reflect.get(
      constructorValue as object,
      'name'
    );
    if (
      Object.prototype.toString.call(constructorNameValue) === '[object String]'
    ) {
      if (String(constructorNameValue) !== '') {
        constructorName = String(constructorNameValue);
      }
    }
  }

  const isSourceCell = constructorName === 'SourceCell';
  const isDerivedCell = constructorName === 'DerivedCell';
  if (isSourceCell) {
    let innerValue: unknown = undefined;
    const getValue = Reflect.get(value as object, 'get');
    if (Object.prototype.toString.call(getValue) === '[object Function]') {
      try {
        innerValue = getValue.call(value);
      } catch {}
    }

    return (
      <>
        <span class={classes.propCellName}>{constructorName}(</span>
        <InspectorPropValue value={innerValue} />
        <span class={classes.propCellName}>)</span>
      </>
    );
  }

  if (isDerivedCell) {
    let innerValue: unknown = undefined;
    const getValue = Reflect.get(value as object, 'get');
    if (Object.prototype.toString.call(getValue) === '[object Function]') {
      try {
        innerValue = getValue.call(value);
      } catch {}
    }

    return (
      <>
        <span class={classes.propCellName}>{constructorName}(</span>
        <InspectorPropValue value={innerValue} />
        <span class={classes.propCellName}>)</span>
      </>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span class={[classes.propValue, classes.propObject]}>{'{}'}</span>;
  }

  return (
    <details class={classes.propExpandable}>
      <summary
        class={[classes.propValue, classes.propObject, classes.propSummary]}
      >
        {constructorName}
      </summary>
      <div class={classes.propNested}>
        <table class={classes.propsTable}>
          <tbody>
            {For(entries, (entry) => (
              <tr class={classes.propsRow}>
                <th class={classes.propNestedKey}>{entry[0]}</th>
                <td class={classes.propValueCell}>
                  <InspectorPropValue value={entry[1]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
