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

let updatedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Upgrade cards to glass
    content = content.replace(/\bbg-white\b/g, 'bg-white/60 backdrop-blur-md border-white/50');
    
    // 2. Soft shadows
    content = content.replace(/\bshadow-(sm|md|lg|xl|2xl)\b/g, 'shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]');
    content = content.replace(/\bshadow\b/g, 'shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]');
    content = content.replace(/\bdrop-shadow-(sm|md|lg|xl)\b/g, 'drop-shadow-sm');
    
    // 3. Button text contrast on the new pastel blue primary
    // Replaces text-white with text-slate-800 if bg-primary is present in the same class string
    content = content.replace(/className="([^"]*\bbg-primary\b[^"]*)\btext-white\b([^"]*)"/g, 'className="$1text-slate-800$2"');
    content = content.replace(/className="([^"]*)\btext-white\b([^"]*\bbg-primary\b[^"]*)"/g, 'className="$1text-slate-800$2"');
    
    // 4. Badges / Tags to soft colors
    content = content.replace(/\bbg-slate-100\b/g, 'bg-blue-100/60 border border-blue-200 text-blue-800');
    content = content.replace(/\bbg-gray-100\b/g, 'bg-indigo-100/60 border border-indigo-200 text-indigo-800');
    
    // 5. Neutralize borders to blend with glass
    content = content.replace(/\bborder-slate-200\b/g, 'border-white/50');
    content = content.replace(/\bborder-gray-200\b/g, 'border-white/50');
    content = content.replace(/\bborder-theme-border\b/g, 'border-white/40');
    
    // 6. Very light pastel tints for cards (randomly assigning soft blue, green, purple to theme-card or cards)
    // We already turned bg-white to glass. But some components use bg-theme-card.
    content = content.replace(/\bbg-theme-card\b/g, 'bg-white/60 backdrop-blur-md border border-white/40');
    content = content.replace(/\bbg-theme-bg\b/g, 'bg-white/30 backdrop-blur-sm');
    
    // 7. Light pastel backgrounds for sections
    content = content.replace(/\bbg-slate-50\b/g, 'bg-transparent');
    content = content.replace(/\bbg-gray-50\b/g, 'bg-transparent');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        updatedFiles++;
    }
});

console.log(`Glassmorphism theme applied successfully to ${updatedFiles} files.`);
