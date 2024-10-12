/**
 * Asynchronously fetches and inlines an SVG icon using its URL.
 * @param {SvgProps} props
 * @returns {Promise<Element>} The SVG element created, or an empty template if the request fails.
 */
export function InlineSvg(props: SvgProps): Promise<Element>;
export type InlineSvgProps = {
    /**
     * address of the svg icon to inline.
     */
    href: string;
};
export type SvgProps = InlineSvgProps & JSX.IntrinsicElements["svg"];
