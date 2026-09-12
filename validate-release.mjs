import { existsSync, readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');
const versions = readJson('versions.json');
const errors = [];
const semanticVersion = /^\d+\.\d+\.\d+$/;

const requiredManifestFields = [
	'id',
	'name',
	'version',
	'minAppVersion',
	'description',
	'author',
	'isDesktopOnly',
];

for (const field of requiredManifestFields) {
	if (manifest[field] === undefined || manifest[field] === '') {
		errors.push(`manifest.json is missing ${field}.`);
	}
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
	errors.push('The plugin ID must use lowercase letters, numbers, and dashes.');
}

if (manifest.id.includes('obsidian') || manifest.id.endsWith('plugin')) {
	errors.push('The plugin ID cannot contain "obsidian" or end with "plugin".');
}

if (/obsidian|plugin/i.test(manifest.name)) {
	errors.push('The plugin name cannot contain "Obsidian" or "plugin".');
}

if (!semanticVersion.test(manifest.version)) {
	errors.push('The plugin version must use the x.y.z format.');
}

if (!semanticVersion.test(manifest.minAppVersion)) {
	errors.push('minAppVersion must use the x.y.z format.');
}

if (
	typeof manifest.description !== 'string' ||
	manifest.description.length > 250 ||
	!/[.!?)]$/.test(manifest.description)
) {
	errors.push('The description must be at most 250 characters and end with punctuation.');
}

if (typeof manifest.isDesktopOnly !== 'boolean') {
	errors.push('isDesktopOnly must be a boolean.');
}

if (packageJson.name !== manifest.id) {
	errors.push('package.json name must match the plugin ID.');
}

if (packageJson.version !== manifest.version) {
	errors.push('package.json and manifest.json versions must match.');
}

if (versions[manifest.version] !== manifest.minAppVersion) {
	errors.push('versions.json must map the current version to minAppVersion.');
}

for (const artifact of ['main.js', 'manifest.json']) {
	if (!existsSync(artifact)) {
		errors.push(`Missing release artifact: ${artifact}.`);
	}
}

if (errors.length > 0) {
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exitCode = 1;
} else {
	console.log(`Release ${manifest.version} is internally consistent.`);
}
