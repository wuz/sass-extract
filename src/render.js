import sass from 'sass';
import { extract, extractSync } from './extract';

/**
 * Render with sass using provided compile options and augment variable extraction
 */
export function render(compileOptions = {}, extractOptions) {
  return new Promise((res, rej) => {
    sass.render(compileOptions, (err, rendered) => {
      if (err) rej(err);
      res(rendered);
    });
  }).then((rendered) => {
    return extract(rendered, { compileOptions, extractOptions }).then((vars) => {
      rendered.vars = vars;
      return rendered;
    });
  });
}

/**
 * Render synchronously with sass using provided compile options and augment variable extraction
 */
export function renderSync(compileOptions = {}, extractOptions) {
  const rendered = sass.renderSync(compileOptions);
  rendered.vars = extractSync(rendered, { compileOptions, extractOptions });
  return rendered;
}
