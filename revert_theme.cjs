const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir(directoryPath);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Revert glass cards
    content = content.replace(/\bbg-white\/60 backdrop-blur-md border-white\/50\b/g, 'bg-white');
    content = content.replace(/\bbg-white\/60 backdrop-blur-md border border-white\/40\b/g, 'bg-theme-card');
    content = content.replace(/\bbg-white\/30 backdrop-blur-sm\b/g, 'bg-theme-bg');
    
    // 2. Revert shadows
    content = content.replace(/\bshadow-\[0_8px_32px_0_rgba\(31,38,135,0\.05\)\]\b/g, 'shadow-sm');
    
    // 3. Revert button text contrast
    content = content.replace(/className="([^"]*\bbg-primary\b[^"]*)\btext-slate-800\b([^"]*)"/g, 'className="$1text-white$2"');
    content = content.replace(/className="([^"]*)\btext-slate-800\b([^"]*\bbg-primary\b[^"]*)"/g, 'className="$1text-white$2"');
    
    // 4. Revert Badges
    content = content.replace(/\bbg-blue-100\/60 border border-blue-200 text-blue-800\b/g, 'bg-slate-100');
    content = content.replace(/\bbg-indigo-100\/60 border border-indigo-200 text-indigo-800\b/g, 'bg-gray-100');
    
    // 5. Revert Neutralized borders
    content = content.replace(/\bborder-white\/50\b/g, 'border-slate-200');
    content = content.replace(/\bborder-white\/40\b/g, 'border-theme-border');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log("Reverted structural class changes.");
