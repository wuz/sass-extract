import sass from 'sass';
import { normalizePath, makeAbsolute } from './util';
import { loadCompiledFiles, loadCompiledFilesSync } from './load';
import { processFiles, parseFiles } from './process';
import { makeImporter, makeSyncImporter } from './importer';
import { Pluggable } from './pluggable';
import path from 'path';

/**
 * Get rendered stats required for extraction
 */
function getRenderedStats(rendered, compileOptions) {
  return {
    entryFilename: normalizePath(rendered.stats.entry),
    includedFiles: rendered.stats.includedFiles.map((f) => normalizePath(makeAbsolute(f))),
    includedPaths: (compileOptions.includePaths || []).map(normalizePath),
  };
}

const handleImports = (extractions, baseFile) => {
  let baseData = extractions[baseFile].injectedData;
  Object.entries(extractions).forEach((entry) => {
    const [key, value] = entry;
    if (key !== baseFile) {
      let relative = path.relative(path.dirname(baseFile), key).replace(/\.[^/.]+$/, '');
      if (relative[0] === '_') {
        relative = relative.substr(1);
      }
      const matcher = new RegExp(`@import ["'](\\.\\/)?${relative}(\\.scss)?["']`);
      const matchedData = baseData.match(matcher);
      if (matchedData) {
        const [match] = matchedData;
        if (match) {
          const parsedValue = handleImports(extractions, key);
          baseData = baseData.replace(match, parsedValue);
        } else {
          baseData = baseData.replace(match, value.injectedData);
        }
      }
    }
  });
  return baseData;
};

/**
 * Make the compilation option for the extraction rendering
 * Set the data to be rendered to the injected source
 * Add compilation functions and custom importer for injected sources
 */
function makeExtractionCompileOptions(compileOptions, entryFilename, extractions, importer) {
  const extractionCompileOptions = Object.assign({}, compileOptions);
  const extractionFunctions = {};

  // Copy all extraction function for each file into one object for compilation
  Object.keys(extractions).forEach((extractionKey) => {
    Object.assign(extractionFunctions, extractions[extractionKey].injectedFunctions);
  });

  extractionCompileOptions.functions = Object.assign(extractionFunctions, compileOptions.functions);

  extractionCompileOptions.data = handleImports(extractions, entryFilename);

  const importers = [].concat(compileOptions.importer);
  if (importer) {
    importers.push(importer);
  }
  extractionCompileOptions.importer = importers.filter(Boolean);

  return extractionCompileOptions;
}

/**
 * Compile extracted variables per file into a complete result object
 */
function compileExtractionResult(orderedFiles, extractions) {
  const extractedVariables = { global: {} };

  orderedFiles.map((filename) => {
    const globalFileVariables = extractions[filename].variables.global;

    Object.keys(globalFileVariables).map((variableKey) => {
      globalFileVariables[variableKey].forEach((extractedVariable) => {
        let variable = extractedVariables.global[variableKey];
        let currentVariableSources = [];
        let currentVariableDeclarations = [];

        if (variable) {
          currentVariableSources = variable.sources;
          currentVariableDeclarations = variable.declarations;
        }

        const hasOnlyDefaults = currentVariableDeclarations.every(
          (declaration) => declaration.flags.default
        );
        const currentIsDefault = extractedVariable.declaration.flags.default;

        if (currentVariableDeclarations.length === 0 || !currentIsDefault || hasOnlyDefaults) {
          variable = extractedVariables.global[variableKey] = Object.assign(
            {},
            extractedVariable.value
          );
        }
        variable.sources =
          currentVariableSources.indexOf(filename) < 0
            ? [...currentVariableSources, filename]
            : currentVariableSources;
        variable.declarations = [
          ...currentVariableDeclarations,
          {
            expression: extractedVariable.declaration.expression,
            flags: extractedVariable.declaration.flags,
            in: filename,
            position: extractedVariable.declaration.position,
          },
        ];
      });
    });
  });

  return extractedVariables;
}

/**
 * Extract the variables from already rendered sass file(s)
 * Returns the extracted variables
 */
export function extract(rendered, { compileOptions = {}, extractOptions = {} } = {}) {
  const pluggable = new Pluggable(extractOptions.plugins).init();

  const { entryFilename, includedFiles, includedPaths } = getRenderedStats(
    rendered,
    compileOptions
  );

  return loadCompiledFiles(includedFiles, entryFilename, compileOptions.data).then(
    ({ compiledFiles, orderedFiles }) => {
      const parsedDeclarations = parseFiles(compiledFiles);
      const extractions = processFiles(orderedFiles, compiledFiles, parsedDeclarations, pluggable);
      const importer = makeImporter(
        extractions,
        includedFiles,
        includedPaths,
        compileOptions.importer
      );
      const extractionCompileOptions = makeExtractionCompileOptions(
        compileOptions,
        entryFilename,
        extractions,
        importer
      );

      return new Promise((res, rej) =>
        sass.render(extractionCompileOptions, (err, rendered) => {
          if (err) rej(err);
          res(rendered);
        })
      ).then(() => {
        return pluggable.run(
          Pluggable.POST_EXTRACT,
          compileExtractionResult(orderedFiles, extractions)
        );
      });
    }
  );
}

/**
 * Synchronously extract the variables from already rendered sass file(s)
 * Returns the extracted variables
 */
export function extractSync(rendered, { compileOptions = {}, extractOptions = {} } = {}) {
  const pluggable = new Pluggable(extractOptions.plugins).init();

  const { entryFilename, includedFiles, includedPaths } = getRenderedStats(
    rendered,
    compileOptions
  );

  const { compiledFiles, orderedFiles } = loadCompiledFilesSync(
    includedFiles,
    entryFilename,
    compileOptions.data
  );
  const parsedDeclarations = parseFiles(compiledFiles);
  const extractions = processFiles(orderedFiles, compiledFiles, parsedDeclarations, pluggable);
  const importer = makeSyncImporter(
    extractions,
    includedFiles,
    includedPaths,
    compileOptions.importer
  );
  const extractionCompileOptions = makeExtractionCompileOptions(
    compileOptions,
    entryFilename,
    extractions,
    importer
  );

  sass.renderSync(extractionCompileOptions);

  return pluggable.run(Pluggable.POST_EXTRACT, compileExtractionResult(orderedFiles, extractions));
}
