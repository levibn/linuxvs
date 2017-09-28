var shell = require('shelljs');
var fs = require('fs');
var packages = JSON.parse(fs.readFileSync('extensions.json', 'utf8'));
shell.exec('tar -xzvf Code.tar.gz;mv Code $HOME/.config/Code;code;cp settings.json $HOME/.config/Code/User/settings.json;', (s, o)=>{
    var sh = [];
    packages.forEach((p)=>{
        sh.push('code --install-extension '+ p);
    });
    sh = sh.join(';');
    shell.exec(sh, (status, output) => {
        shell.exec('code;');
    });
});

