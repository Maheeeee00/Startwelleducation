STARTWELL EDUCATION - SCHOOL WEBSITE
====================================
Open index.html in any browser to view the site.

PAGES (menu structure):
  Home .............. index.html
  About Us .......... aboutus.html
  Academics ......... academics.html
     - Curriculum ......... curriculum.html
     - Faculty & Staff .... faculty.html
     - School Calendar .... calendar.html
  Activities ........ activities.html
     - Online Activities .. online-activities.html
     - Facebook Page ...... facebook.html
     - Projects ........... projects.html
  Teams ............. teams.html
     - Junior Media Team .. junior-media-team.html
     - Senior Media Team .. senior-media-team.html
     - StartWell Spelling Bee .. spelling-bee.html
  Admissions ........ admissions.html
  Gallery ........... gallery.html
  Contact ........... contact.html

SOCIAL LINKS: Facebook (startwell.educationbhimber) and TikTok
(@startwell.edu) are connected on every page. The Facebook page also
shows a live feed on facebook.html.

SCHOOL CALENDAR: once the Google Sheet is connected, edit holidays in its
"Holidays" tab. Past holidays grey out automatically and the next one is
highlighted.
FOLDERS: css/style.css (all styling), js/main.js (menu, animations,
         gallery lightbox, tabs, form), images/ (your photos & logo)

CONTACT: phone +92 340 1501700 and email startwelleducationbhimber@gmail.com
are used on every page (top bar, footer, contact page, principal profile).

PLEASE UPDATE BEFORE PUBLISHING (placeholders):
- Address       : Bhimber, Azad Jammu & Kashmir (add full street address)

- School timings table on academics.html
- Map location in contact.html (the "q=" value in the iframe)
Tip: phone/email/address appear on every page - use "Find & Replace
in files" in VS Code to change them all at once.

EMAIL (Web3Forms): the Contact form and the Online Admission form are
emailed to the inbox registered with the Web3Forms key in js/config.js
(free plan: 250 emails/month). Reply to the email to answer the parent.
Tip: in your web3forms.com dashboard you can restrict the key to your
domain startwell.edu.pk.

GOOGLE SHEETS BACKEND: one script (google-apps-script/Code.gs) handles all
website data. Forms (Contact, Online Admission with photo + B-Form upload)
save into the Sheet; Gallery, News Ticker and Holidays are edited in the
Sheet and update the website live. All tabs/columns are created
automatically. Follow GOOGLE-SHEETS-SETUP.txt, then paste the Web app URL
into js/config.js (optional). Without it, forms are still emailed via
Web3Forms; the photo/B-Form upload boxes only appear once the Sheet is
connected (files need Google Drive).

GALLERY: once the Google Sheet is connected, add photos to the Drive folder
"Start Well Website Gallery" and use the sheet menu "Add photos from Drive".
