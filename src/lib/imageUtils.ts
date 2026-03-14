/**
 * Converts common cloud storage "view" links into direct image links
 * currently supports: Google Drive, Dropbox
 */
export const getDirectImageUrl = (url: string | undefined | null): string => {
    if (!url) return '';

    // Handle local uploads (served from backend)
    if (url.startsWith('/uploads/')) {
        const base = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace('/api', '')
            : 'http://localhost:5000';
        return `${base}${url}`;
    }

    // Google Drive conversion
    // Using lh3.googleusercontent.com/d/ID format which is highly reliable for direct embedding
    const driveMatch = url.match(/(?:\/d\/|id=|file\/d\/)([a-zA-Z0-9_-]{25,})/);
    if (url.includes('drive.google.com') && driveMatch) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    // Dropbox conversion
    // From: https://www.dropbox.com/s/ID/name.jpg?dl=0
    // To:   https://www.dropbox.com/s/ID/name.jpg?raw=1
    if (url.includes('dropbox.com')) {
        return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
    }

    return url;
};
