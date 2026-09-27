import DOMPurify from 'dompurify';
import { createElement, type CSSProperties, type JSX } from 'react';

/* Content from the API may contain a small set of inline HTML (b, i, em, kbd, span.ic, span.t-mono).
   Everything is sanitized before it reaches the DOM. */
const CONFIG = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'span', 'kbd', 'br', 'code', 'small', 'u', 'sup', 'sub'],
  ALLOWED_ATTR: ['class'],
};

export const clean = (html: string | null | undefined) => DOMPurify.sanitize(html || '', CONFIG) as string;
export const plain = (html: string | null | undefined) => (html || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<');

type Props = { html: string | null | undefined; as?: keyof JSX.IntrinsicElements; className?: string; style?: CSSProperties; id?: string };

export function Html({ html, as = 'span', className, style, id }: Props) {
  return createElement(as, { className, style, id, dangerouslySetInnerHTML: { __html: clean(html) } });
}
