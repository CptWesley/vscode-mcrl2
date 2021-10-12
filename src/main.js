const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const px = require('path');

const output = vscode.window.createOutputChannel('mCRL2');

const equivalenceTypes = {
	'Weak Trace Equivalence': 'weak-trace',
	'Strong Trace Equivalence': 'trace',
	'Weak Bisimilarity': 'weak-bisim',
	'Strong Bisilimarity (O(mlogn))': 'bisim',
	'Strong Bisilimarity (O(mn))': 'bisim-gv',
	'Strong Bisilimarity (O(mlogm))': 'bisim-gjkw',
	'Branching Bisilimarity (O(mlogn))': 'branching-bisim',
	'Branching Bisilimarity (O(mn))': 'branching-bisim-gv',
	'Branching Bisilimarity (O(mlogm))': 'branching-bisim-gjkw',
	'Divergence-preserving Branching Bisilimarity (O(mlogn))': 'dpbranching-bisim',
	'Divergence-preserving Branching Bisilimarity (O(mn))': 'dpbranching-bisim-gv',
	'Divergence-preserving Branching Bisilimarity (O(mlogm))': 'dpbranching-bisim-gjkw',
	'Divergence-preserving Weak Bisimilarity': 'dpweak-bisim',
	'Strong Simulation Equivalence': 'sim',
	'Strong Ready Simulation Equivalence': 'ready-sim',
	'Coupled Simulation Equivalence': 'coupled-sim',
};

const equivalenceNames = Object.keys(equivalenceTypes);

function activate(context) {
	register(context, 'mcrl2.parse', parse);
	register(context, 'mcrl2.showGraph', showGraph);
	register(context, 'mcrl2.simulate', simulate);
	register(context, 'mcrl2.verifyProperties', verifyProperties);
	register(context, 'mcrl2.equivalence', equivalence);
	register(context, 'mcrl2.clean', clean);
}

function deactivate() {
	//nothing
}

function clean() {
	fs.rmdirSync(toProjectPath('./out'), { recursive: true });
}

function register(context, name, func) {
	let disposable = vscode.commands.registerCommand(name, function() {
		output.clear();
		output.show(true);
		ensureDirectory(toProjectPath('./out'));
		func();
	});
	context.subscriptions.push(disposable);
}

function equivalence() {
	const dir = toProjectPath();
	const files = Array.from(getFiles(dir, '.mcrl2'));
	const names = [];
	const map = {};

	for (let i = 0; i < files.length; ++i) {
		const file = files[i];
		const name = px.relative(dir, file);
		names.push(name);
		map[name] = file;
	}

	vscode.window.showQuickPick(names).then(x => {
		if (!x) {
			return;
		}

		const file = map[x];

		vscode.window.showQuickPick(equivalenceNames).then(x => {
			if (!x) {
				return;
			}

			const equivalence = equivalenceTypes[x];
			mcrl22lts(vscode.window.activeTextEditor.document.fileName, () => {
				mcrl22lts(file, () => {
					runMcrl2('ltscompare', ['-c', '--equivalence=' + equivalence, toOutputFileName(vscode.window.activeTextEditor.document.fileName, '.lts'), toOutputFileName(file, '.lts')], (result) => {
						const lines = result.split(/\r?\n/);
						const line = lines[lines.length - 1];
						if (line === 'false') {
							
							output.appendLine('\nCounter Example Trace:');
							runMcrl2('tracepp', [toProjectPath('./out/Counterexample0.trc')]);
						}
					});
				});
			});
		});
	});
}

function parse() {
	runMcrl2('mcrl22lps', ['-e', vscode.window.activeTextEditor.document.fileName]);
}

function showGraph() {
	mcrl22lts(vscode.window.activeTextEditor.document.fileName, () => {
		runMcrl2('ltsgraph', [toOutputFileName(vscode.window.activeTextEditor.document.fileName, '.lts')]);
	});
}

function simulate() {
	mcrl22lps(vscode.window.activeTextEditor.document.fileName, () => {
		runMcrl2('lpsxsim', [toOutputFileName(vscode.window.activeTextEditor.document.fileName, '.lps')]);
	})
}

function verifyProperties() {
	let dir = toProjectPath();
	let files = Array.from(getFiles(dir, '.mcf'));
	output.appendLine('Starting property verification for ' + files.length + ' properties:');
	mcrl22lps(vscode.window.activeTextEditor.document.fileName, () => verifyNextProperty(files, 0, 0, toOutputFileName(vscode.window.activeTextEditor.document.fileName, '.lps')));
}

function verifyNextProperty(files, success, total, lpsFile) {
	if (files.length == 0) {
		output.appendLine('Finished verifying properties.');
		output.appendLine('Successfully verified: ' + success + '/' + total);
		return;
	}

	const head = files[0];
	const tail = files.slice(1);
	runMcrl2('lps2pbes', [lpsFile, '-f', head, '|',  createCommand('pbes2bool')], (result) => {
		const name = px.relative(toProjectPath(), head);
		if (result === 'true') {
			output.appendLine('[SUCCEEDED] ' + name);
			success++;
		} else {
			output.appendLine('[FAILED] ' + name);
			
			if (result !== 'false') {
				output.appendLine(result);
			}
		}
		verifyNextProperty(tail, success, total + 1, lpsFile);
	}, true);
}

function ensureDirectory(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
}

function toProjectPath(pathName='') {
	const dir = vscode.workspace.workspaceFolders
		? vscode.workspace.workspaceFolders.filter(x => x.name == vscode.workspace.name)[0].uri.fsPath
		: px.dirname(vscode.window.activeTextEditor.document.fileName);
	const normalized = px.normalize(dir);
	const trimmed = pathName.trim();

	if (trimmed.length == 0) {
		return normalized;
	}

	return px.join(normalized, trimmed);
}

function createCommand(cmd) {
	const config = vscode.workspace.getConfiguration('mcrl2');
	const binPath = config.get('binPath').trim();
	
	if (binPath.length == 0) {
		return cmd.trim();
	}

	return '"' + px.join(px.normalize(binPath), cmd.trim()) + '"';
}

function run(cmd, callback=function(){}, suppressed=false, errorCallback=function(){}) {
	const process = cp.exec(cmd, {
		cwd: toProjectPath('./out'),
	});
	let result = '';
	process.stdout.setEncoding('utf8');
	process.stderr.setEncoding('utf8');
	process.stdout.on('data', function(data) {
		if (!suppressed) {
			output.append(data.toString());
		}
		result += data.toString();
	});
	process.stderr.on('data', function(data) {
		if (!suppressed) {
			output.append(data.toString());
		}
		result += data.toString();
	});
	process.on('close', function(code) {
		if (code == 0) {
			callback(result.trim());
		} else {
			errorCallback(result.trim());
		}
	});
}

function runMcrl2(cmd, args, callback=function(){}, suppressed=false, errorCallback=function(){}) {
	vscode.window.activeTextEditor.document.save().then(x => {
		let argString = args.map(x => {
			let trimmed = x.trim();
			if (trimmed.includes(' ')) {
				return '"' + trimmed + '"';
			}

			return trimmed;
		}).join(' ');
		run(createCommand(cmd) + ' ' + argString, callback, suppressed, errorCallback);
	});
}

function *getFiles(dir, withExtension='') {
	let files = fs.readdirSync(dir, { withFileTypes: true });
	for (let file of files) {
	  	if (file.isDirectory()) {
			yield* getFiles(px.join(dir, file.name), withExtension);
	  	} else if (file.name.endsWith(withExtension)) {
			yield px.join(dir, file.name);
	  	}
	}
}

function transformFileName(fileName) {
	const x = px.relative(toProjectPath(), fileName).replaceAll('/', '.').replaceAll('\\', '.');
	return x.split('.').slice(0, -1).join('.');
}

function toOutputFileName(fileName, extension) {
	return toProjectPath(px.join('./out/', transformFileName(fileName) + extension));
}

function mcrl22lps(fileName, callback=()=>{}) {
	runMcrl2('mcrl22lps', [fileName, toOutputFileName(fileName, '.lps')], callback);
}

function lps2lts(fileName, callback=()=>{}) {
	runMcrl2('lps2lts', [toOutputFileName(fileName, '.lps'), toOutputFileName(fileName, '.lts')], callback);
}

function mcrl22lts(fileName, callback=()=>{}) {
	mcrl22lps(fileName, () => lps2lts(fileName, callback));
}

module.exports = {
	activate,
	deactivate
}
