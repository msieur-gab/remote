export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function cloneTemplate(id) {
  const tpl = document.getElementById(id);
  if (!(tpl instanceof HTMLTemplateElement)) throw new Error(`Template #${id} missing`);
  return tpl.content.firstElementChild.cloneNode(true);
}

export function mount(root, node) {
  root.replaceChildren(node);
  return node;
}
