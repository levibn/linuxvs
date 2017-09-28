var shell = require('shelljs');
var fs = require('fs');
var packages = JSON.parse(fs.readFileSync('extensions.json', 'utf8'));
shell.exec('cp settings.json $HOME/.config/Code/User/settings.json;');
var sh = [];
packages.forEach((p)=>{
    sh.push('code --install-extension '+ p);
});
sh = sh.join(';');
shell.exec(sh, (status, output) => {
    
});
