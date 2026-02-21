#!/usr/bin/env node

import process from 'process';

const VERSION = '0.1.0';

function showHelp(): void {
  console.log(`facet - Faceted Prompting CLI

Usage: facet [options]

Options:
  --help     Display this help message
  --version  Display version information`);
}

function showVersion(): void {
  console.log(VERSION);
}

export function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: No arguments provided. Use --help for usage information.');
    process.exit(1);
  }

  const flag = args[0];

  switch (flag) {
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);
    case '--version':
    case '-v':
      showVersion();
      process.exit(0);
    default:
      console.error(`Error: Unknown flag '${flag}'. Use --help for usage information.`);
      process.exit(1);
  }
}

main();
