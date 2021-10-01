const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const px = require('path');

let output = vscode.window.createOutputChannel('mCRL2');

function activate(context) {
	register(context, 'mcrl2.parse', parse);
	register(context, 'mcrl2.showGraph', showGraph);
}

function deactivate() {
	//nothing
}

function register(context, name, func) {
	let disposable = vscode.commands.registerCommand(name, function() {
		output.clear();
		output.show(true);
		func();
	});
	context.subscriptions.push(disposable);
}

function parse() {
	runMcrl2("mcrl22lps", ["-e", vscode.window.activeTextEditor.document.fileName]);
}

function showGraph() {
	ensureDirectory(toProjectPath('./out'));

	runMcrl2("mcrl22lps", [vscode.window.activeTextEditor.document.fileName, toProjectPath("./out/temp.lps")], () => {
		runMcrl2("lps2lts", [toProjectPath("./out/temp.lps"), toProjectPath("./out/temp.lts")], () => {
			runMcrl2("ltsgraph", [toProjectPath("./out/temp.lts")]);
		});
	});
}

function ensureDirectory(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
}

function toProjectPath(pathName) {
	let dir = vscode.workspace.workspaceFolders.filter(x => x.name == vscode.workspace.name)[0].uri.fsPath;
	let normalized = px.normalize(dir);
	return px.join(normalized, pathName);
}

function createCommand(cmd) {
	let config = vscode.workspace.getConfiguration('mcrl2');
	var binPath = config.get('binPath').trim();

	if (binPath.length == 0) {
		return cmd.trim();
	}

	if (binPath.length > 0 && binPath[binPath.length - 1] != '/' && binPath[binPath.length - 1] != '\\') {
		binPath += '/';
	}

	return binPath + cmd.trim();
}

function run(cmd, callback=function(){}) {
	let process = cp.exec(cmd);
	process.stdout.setEncoding('utf8');
	process.stderr.setEncoding('utf8');
	process.stdout.on('data', function(data) {
		output.append(data.toString());
	});
	process.stderr.on('data', function(data) {
		output.append(data.toString());
	});
	process.on('close', function(code) {
		if (code == 0) {
			callback();
		}
	});
}

function runMcrl2(cmd, args, callback=function(){}) {
	let argString = args.map(x => x.trim()).join(' ');
	return run(createCommand(cmd) + " " + argString, callback);
}

module.exports = {
	activate,
	deactivate
}
