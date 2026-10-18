export function slug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
