import { FluidList } from 'retend-utils/components';
import { Cell } from 'retend';

const boxes = Cell.source([
  { id: 1, color: 'red' },
  { id: 2, color: 'blue' },
  { id: 3, color: 'green' },
]);

const addBox = () => {
  const boxesArray = boxes.get();
  const newId = boxesArray.length + 1;
  boxesArray.push({
    id: newId,
    color: `hsl(${(newId * 360) / 10}, 100%, 50%)`,
  });
};

const removeBox = (id: number) => {
  boxes.set(boxes.get().filter((box) => box.id !== id));
};

const shuffleBoxes = () => {
  const shuffledBoxes = [...boxes.get()].sort(() => Math.random() - 0.5);
  boxes.set(shuffledBoxes);
};

const FluidListExample = () => (
  <div>
    <h2>FluidList Example</h2>
    <FluidList
      items={boxes}
      direction="inline"
      itemHeight="50px"
      itemWidth="50px"
      maxColumns={4}
      gap="5px"
      Template={(props) => (
        <button
          type="button"
          style={{
            width: '50px',
            height: '50px',
            backgroundColor: props.item.color,
          }}
          onClick={() => removeBox(props.item.id)}
        />
      )}
    />
    <button type="button" onClick={addBox}>
      Add Box
    </button>
    <button
      type="button"
      onClick={shuffleBoxes}
      style={{ marginBottom: '10px' }}
    >
      Shuffle Boxes
    </button>
  </div>
);

export default FluidListExample;
