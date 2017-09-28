var shell = require('shelljs');
var fs = require('fs');
var filename = (process.argv[2])?process.argv[2]:'mylinuxvs';
shell.exec('code --list-extensions;', (status, output) => {
    var e = output.split('\n');
    var ext = [];
    e.forEach((x)=>{
        if(x != '')
            ext.push(x);
    });
    fs.writeFileSync('extensions.json', JSON.stringify(ext));
    shell.exec('cp $HOME/.config/Code/User/settings.json settings.json;cd .. ;tar -czvf '+filename+'.tar.gz linuxvs;')
});