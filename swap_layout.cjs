const fs = require('fs');
const path = 'c:/Users/ANUSHKA/IEMRF/Conference-Room-Booking-System/frontend-user/src/pages/MyBookingsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Rename the labels in the Quick Stats Grid
content = content.replace('>Upcoming</p>', '>Upcoming Booking</p>');
content = content.replace('>Total</p>', '>Total Bookings</p>');
content = content.replace('>Cancelled</p>', '>Cancelled Booking</p>');

// Swap the columns
const leftColStart = '                {/* Left Column: Personal Calendar & Stats */}';
const rightColStart = '                {/* Right Column: Bookings List */}';

const p1 = content.indexOf(leftColStart);
const p2 = content.indexOf(rightColStart);
const p3 = content.lastIndexOf('            </div>');

if (p1 !== -1 && p2 !== -1 && p3 !== -1) {
    const pre = content.substring(0, p1);
    const leftCol = content.substring(p1, p2);
    const rightCol = content.substring(p2, p3);
    const post = content.substring(p3);

    fs.writeFileSync(path, pre + rightCol + leftCol + post);
    console.log("Edit successful");
} else {
    console.log("Could not find blocks. p1:", p1, "p2:", p2, "p3:", p3);
}
