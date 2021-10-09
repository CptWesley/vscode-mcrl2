const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const px = require('path');

let output = vscode.window.createOutputChannel('mCRL2');

function activate(context) {
	register(context, 'mcrl2.parse', parse);
	register(context, 'mcrl2.showGraph', showGraph);
	register(context, 'mcrl2.simulate', simulate);
	register(context, 'mcrl2.verifyProperties', verifyProperties);
}

function deactivate() {
	//nothing
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

function parse() {
	runMcrl2('mcrl22lps', ['-e', vscode.window.activeTextEditor.document.fileName]);
}

function showGraph() {
	runMcrl2('mcrl22lps', [vscode.window.activeTextEditor.document.fileName, toProjectPath('./out/temp.lps')], () => {
		runMcrl2('lps2lts', [toProjectPath('./out/temp.lps'), toProjectPath('./out/temp.lts')], () => {
			runMcrl2('ltsgraph', [toProjectPath('./out/temp.lts')]);
		});
	});
}

function simulate() {
	runMcrl2('mcrl22lps', [vscode.window.activeTextEditor.document.fileName, toProjectPath('./out/temp.lps')], () => {
		runMcrl2('lpsxsim', [toProjectPath('./out/temp.lps')]);
	});
}

function verifyProperties() {
	let dir = toProjectPath();
	runMcrl2('mcrl22lps', [vscode.window.activeTextEditor.document.fileName, toProjectPath('./out/temp.lps')], () => {
		for (let mcf of getFiles(dir, '.mcf')) {
			runMcrl2('lps2pbes', [toProjectPath('./out/temp.lps'), '-f', mcf, '| ' + createCommand('pbes2bool')], (result) => {
				if (result === 'true') {
					output.appendLine('[SUCCEEDED] ' + mcf);
				} else {
					output.appendLine('[FAILED] ' + mcf);
				}
			}, true);
		}
	});
}

function ensureDirectory(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
}

function toProjectPath(pathName='') {
	let dir = vscode.workspace.workspaceFolders
		? vscode.workspace.workspaceFolders.filter(x => x.name == vscode.workspace.name)[0].uri.fsPath
		: px.dirname(vscode.window.activeTextEditor.document.fileName);
	let normalized = px.normalize(dir);
	let trimmed = pathName.trim();

	if (trimmed.length == 0) {
		return normalized;
	}

	return px.join(normalized, trimmed);
}

function createCommand(cmd) {
	let config = vscode.workspace.getConfiguration('mcrl2');
	let binPath = config.get('binPath').trim();
	
	if (binPath.length == 0) {
		return cmd.trim();
	}

	return '"' + px.join(px.normalize(binPath), cmd.trim()) + '"';
}

function run(cmd, callback=function(){}, suppressed=false) {
	let process = cp.exec(cmd);
	var result = '';
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
		}
	});
}

function runMcrl2(cmd, args, callback=function(){}, suppressed=false) {
	vscode.window.activeTextEditor.document.save().then(x => {
		let argString = args.map(x => '"' + x.trim() + '"').join(' ');
		run(createCommand(cmd) + ' ' + argString, callback, suppressed);
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

module.exports = {
	activate,
	deactivate
}
