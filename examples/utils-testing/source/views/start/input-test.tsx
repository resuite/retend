import { Input } from 'retend-utils/components';
import { Cell } from 'retend';

const InputTest = () => {
  const textModel = Cell.source('');
  const numberModel = Cell.source(0);
  const passwordModel = Cell.source('');
  const checkboxModel = Cell.source(false);
  const dateModel = Cell.source(new Date()); // Initialize as Date, per component source

  // Derived cells for reactive display formatting
  const checkboxString = Cell.derived(() => String(checkboxModel.get()));
  const dateString = Cell.derived(() => dateModel.get()?.toDateString() ?? '');

  return (
    <div>
      <h2>Input Component Test</h2>

      <section style={{ marginBottom: '1rem' }}>
        <h3>Text Input</h3>
        <Input type="text" model={textModel} placeholder="Enter text" />
        <p>Current value: {textModel}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3>Number Input</h3>
        <Input type="number" model={numberModel} />
        <p>Current value: {numberModel}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3>Password Input</h3>
        <Input
          type="password"
          model={passwordModel}
          placeholder="Enter password"
        />
        <p>Current value: {passwordModel}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3>Checkbox Input</h3>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
        <label>
          <Input type="checkbox" model={checkboxModel} />
          Toggle me
        </label>
        <p>Current value: {checkboxString}</p>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3>Date Input</h3>
        <Input type="date" model={dateModel} />
        <p>Current value: {dateString}</p>
      </section>
    </div>
  );
};

export default InputTest;
