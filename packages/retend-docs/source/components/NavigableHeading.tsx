import { Cell, onSetup } from 'retend';
import { JSX } from 'retend/jsx-runtime';
import { useCurrentRoute } from 'retend/router';

type HeadingProps = JSX.IntrinsicElements['h2'] | JSX.IntrinsicElements['h3'];

interface NavigableHeadingProps extends HeadingProps {
  as: 'h2' | 'h3';
}

export function NavigableHeading(props: NavigableHeadingProps) {
  const { as, class: className, ...rest } = props;
  const route = useCurrentRoute();

  const ref = Cell.source<HTMLElement | null>(null);
  const hash = Cell.derived(() => route.get().hash);

  const scrollIntoView = () => {
    const heading = ref.get();
    if (heading && hash.get() === heading.id) {
      heading.scrollIntoView({ block: 'start' });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          heading.scrollIntoView({ block: 'start' });
        });
      });
    }
  };

  hash.listen(scrollIntoView);
  onSetup(scrollIntoView);

  if (as === 'h2') {
    return <h2 ref={ref} class={[className, 'scroll-mt-32']} {...rest} />;
  }
  if (as === 'h3') {
    return <h3 ref={ref} class={[className, 'scroll-mt-32']} {...rest} />;
  }
}
