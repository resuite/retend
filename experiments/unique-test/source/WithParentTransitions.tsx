import { Cell, createUnique, For, If, onConnected } from 'retend';
import { UniqueTransition } from 'retend-utils/components';

const items = [
  { id: 1, name: 'Item 1', description: 'Description of Item 1' },
  { id: 2, name: 'Item 2', description: 'Description of Item 2' },
  { id: 3, name: 'Item 3', description: 'Description of Item 3' },
];

const Item = createUnique<{ item: (typeof items)[number] }>((props) => {
  const item = Cell.derived(() => props.get().item);
  const name = Cell.derived(() => item.get().name);
  const description = Cell.derived(() => item.get().description);

  return (
    <UniqueTransition transitionDuration="1200ms">
      <div style={{ height: '130px', minWidth: '200px' }}>
        <h2>{name}</h2>
        <p>{description}</p>
      </div>
    </UniqueTransition>
  );
});

export function WithParentTransitions() {
  console.log('Rendering WithParentTransitions');
  const selectedItemId = Cell.source<number | null>(1);

  return (
    <div>
      <h1>List of items.</h1>

      <ul>
        {For(items, (item) => (
          <li style={{ listStyleType: 'none' }}>
            <Item id={`item-heading-${item.id}`} item={item} />
            <button type="button" onClick={() => selectedItemId.set(item.id)}>
              Open
            </button>
          </li>
        ))}
      </ul>

      {If(selectedItemId, (itemId) => {
        const item = items.find((i) => i.id === itemId);
        const ref = Cell.source<HTMLDialogElement | null>(null);
        if (!item) return null;

        onConnected(ref, (dialog) => {
          dialog.showModal();
          dialog.animate(
            [
              { transform: 'translateY(70%)', opacity: '0.05' },
              { transform: 'scale(1)' },
            ],
            {
              duration: 1200,
              easing: 'ease',
            }
          );
        });

        const handleClick = () => {
          const dialog = ref.get();
          if (!dialog) return;

          dialog
            .animate(
              [
                { transform: 'scale(1)', opacity: '1' },
                { transform: 'translateY(70%)', opacity: '0.05' },
              ],
              { duration: 1200, easing: 'ease' }
            )
            .finished.then(() => {
              dialog.close();
            });
        };

        return (
          <dialog
            ref={ref}
            style={{ overflow: 'visible' }}
            onClose={() => selectedItemId.set(null)}
          >
            <Item id={`item-heading-${item.id}`} item={item} />
            <button type="button" onClick={handleClick}>
              Close
            </button>
          </dialog>
        );
      })}
    </div>
  );
}
