/* =========================================================
   Wonder Agency · Project intake — app logic
   ========================================================= */

const STORAGE_KEY = 'wonder_intake_v2';
const SAVE_DEBOUNCE_MS = 400;

/* -----------------------------------------------------------
   Apps Script submission endpoint.
   Swap this URL for the deployed Apps Script web-app URL before go-live.
   The script should accept a POST with JSON body and return { ok: true }.
   ----------------------------------------------------------- */
const SUBMIT_ENDPOINT = 'YOUR_APPS_SCRIPT_ENDPOINT_URL';

function wonderIntake() {
  return {
    /* ---------- Navigation state ---------- */
    currentPhase: 0,
    hasDraft: false,
    dismissedResume: false,
    saveIndicator: '',
    submitting: false,
    submitted: false,
    submitError: '',
    copyFeedback: '',
    _saveTimer: null,
    _pendingDraft: null,

    /* ---------- Form data ---------- */
    data: {
      // Phase 1 — About you
      contactName: '',
      contactRole: '',
      contactEmail: '',
      contactPhone: '',
      additionalContacts: '',

      // Phase 2 — Your business
      businessName: '',
      industry: '',
      industryOther: '',
      pitch: '',
      description: '',
      usps: '',

      // Phase 3 — Tone & feel
      tone: {
        formalCasual: 3,
        seriousPlayful: 3,
        understatedBold: 3,
        traditionalModern: 3,
      },
      brandFeeling: '',
      voiceAvoid: '',

      // Phase 4 — Pages needed
      pagesNeeded: ['home'], // home is always included
      customPages: '',

      // Phase 5 — Copywriting preference + per-page content
      copywritingPreference: 'wonder', // 'client' | 'wonder'
      pageContent: {}, // keyed by page slug, value = string

      // Phase 6 — Brand & visuals
      brand: {
        status: '', // 'have' | 'starting-fresh' | ''
        primaryColour: '',
        accentColour: '',
        logoUploaded: '', // Uploadcare CDN URL
        logoLink: '',
        brandGuidelinesUploaded: '',
        brandGuidelinesLink: '',
        fontPreference: '', // 'have' | 'need' | 'open'
        fontDetails: '',
      },

      // Phase 7 — Audience & photography
      audience: {
        description: '',
        ageRange: '',
        location: '',
      },
      photography: {
        assetStatus: '', // 'have' | 'some' | 'none'
        assetsLink: '',
        photosUploaded: '',
      },

      // Phase 8 — Restaurant only
      restaurant: {
        openingHours: {
          monday:    { closed: true,  lunch: '', dinner: '', notes: '' },
          tuesday:   { closed: false, lunch: '', dinner: '', notes: '' },
          wednesday: { closed: false, lunch: '', dinner: '', notes: '' },
          thursday:  { closed: false, lunch: '', dinner: '', notes: '' },
          friday:    { closed: false, lunch: '', dinner: '', notes: '' },
          saturday:  { closed: false, lunch: '', dinner: '', notes: '' },
          sunday:    { closed: false, lunch: '', dinner: '', notes: '' },
        },
        menuUploaded: '',
        menuLink: '',
        menuChanges: '',       // how often menus change
        menuContact: '',       // who sends updates
        dietaryFilters: '',
        bookingPlatform: '',   // 'opentable' | 'sevenrooms' | 'resdiary' | 'phone' | 'other'
        bookingLink: '',
        walkInPolicy: '',
        groupSizeLimit: '',
        privateDining: '',     // 'yes' | 'no'
        pdCapacities: '',
        pdPricing: '',
        pdEventTypes: '',
      },

      // Phase 9 — Contact, socials, tech
      location: {
        address: '',
        showMap: 'yes', // 'yes' | 'no'
      },
      socials: {
        instagram: '',
        tiktok: '',
        facebook: '',
        linkedin: '',
        youtube: '',
        other: '',
      },
      press: '',
      referenceSites: '',
      tech: {
        domainOwned: '',       // 'yes' | 'no' | 'unsure'
        domainProvider: '',
        hasAdminDomain: '',    // 'yes' | 'no' | 'unsure'
        existingSiteUrl: '',
        hasAdminWebsite: '',   // 'yes' | 'no' | 'unsure'
        emailHosting: '',
        platformPreference: '',
        analytics: '',
      },
      anythingElse: '',
    },

    /* ---------- Static options ---------- */
    industryOptions: [
      { value: 'restaurant',    label: 'Restaurant & Hospitality' },
      { value: 'hotel',         label: 'Hotel / Stay' },
      { value: 'retail',        label: 'Retail & E-commerce' },
      { value: 'design-studio', label: 'Design & Creative Studio' },
      { value: 'professional',  label: 'Professional Services' },
      { value: 'wellness',      label: 'Wellness / Beauty' },
      { value: 'other',         label: 'Something else' },
    ],

    toneSliders: [
      { key: 'formalCasual',      left: 'Formal',      right: 'Casual' },
      { key: 'seriousPlayful',    left: 'Serious',     right: 'Playful' },
      { key: 'understatedBold',   left: 'Understated', right: 'Bold' },
      { key: 'traditionalModern', left: 'Traditional', right: 'Modern' },
    ],

    // Page catalogue. restaurantOnly = true means only show for restaurant industry.
    pageCatalogue: [
      { slug: 'home',        label: 'Home',                       always: true,  description: 'Your front door. Everyone lands here first.' },
      { slug: 'about',       label: 'About',                      description: 'Your story, your people, your values.' },
      { slug: 'menus',       label: 'Menus',                      restaurantOnly: true, description: 'Food and drink menus, clearly presented.' },
      { slug: 'gallery',     label: 'Gallery',                    description: 'Photography showcase of your space, work, or food.' },
      { slug: 'services',    label: 'Services / offerings',       description: 'What you do, in detail.' },
      { slug: 'shop',        label: 'Shop / products',            description: 'Online store with products and checkout.' },
      { slug: 'blog',        label: 'Blog / journal',             description: 'Articles, news, and longer-form content.' },
      { slug: 'contact',     label: 'Contact',                    description: 'How to get in touch, map, opening hours.' },
      { slug: 'private',     label: 'Private dining / events',    restaurantOnly: true, description: 'Bookable spaces for private events and parties.' },
      { slug: 'booking',     label: 'Booking / reservations',     restaurantOnly: true, description: 'Reservation widget or booking flow.' },
      { slug: 'faq',         label: 'FAQ',                        description: 'Common questions answered up front.' },
    ],

    bookingPlatforms: [
      { value: 'opentable',   label: 'OpenTable' },
      { value: 'sevenrooms',  label: 'SevenRooms' },
      { value: 'resdiary',    label: 'ResDiary' },
      { value: 'designmynight', label: 'DesignMyNight' },
      { value: 'phone',       label: 'Phone only' },
      { value: 'none',        label: 'We don\'t take bookings' },
      { value: 'other',       label: 'Something else' },
    ],

    daysOfWeek: [
      { key: 'monday',    label: 'Mon' },
      { key: 'tuesday',   label: 'Tue' },
      { key: 'wednesday', label: 'Wed' },
      { key: 'thursday',  label: 'Thu' },
      { key: 'friday',    label: 'Fri' },
      { key: 'saturday',  label: 'Sat' },
      { key: 'sunday',    label: 'Sun' },
    ],

    /* ---------- Dynamic phase labels ---------- */
    get phaseLabels() {
      const labels = [
        'Welcome',
        'About you',
        'Your business',
        'Tone & feel',
        'Pages needed',
        'Page content',
        'Brand & visuals',
        'Audience & photography',
      ];
      if (this.isRestaurant) labels.push('Restaurant details');
      labels.push('Contact & tech');
      labels.push('Review & submit');
      return labels;
    },

    get totalPhases() {
      // Excluding welcome. Restaurant = 10, others = 9.
      return this.isRestaurant ? 10 : 9;
    },

    get currentPhaseLabel() {
      return this.phaseLabels[this.currentPhase] || '';
    },

    get currentPhaseNumber() {
      // Human-readable phase number (1-based, excluding welcome)
      return this.currentPhase;
    },

    /* ---------- Lifecycle ---------- */
    init() {
      this.checkForDraft();
      this.setupAutosave();
    },

    checkForDraft() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.data && this.hasMeaningfulContent(parsed.data)) {
            this.hasDraft = true;
            this._pendingDraft = parsed;
          }
        }
      } catch (err) {
        console.warn('Could not read saved draft:', err);
      }
    },

    hasMeaningfulContent(data) {
      return !!(
        data.contactName || data.businessName || data.pitch ||
        data.description || data.contactEmail
      );
    },

    resumeDraft() {
      if (this._pendingDraft) {
        this.data = this.deepMerge(this.data, this._pendingDraft.data);
        this.currentPhase = this._pendingDraft.currentPhase || 1;
      }
      this.dismissedResume = true;
      this.hasDraft = false;
    },

    startFresh() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
      this.dismissedResume = true;
      this.hasDraft = false;
      this._pendingDraft = null;
    },

    // Deep merge helper — preserves new fields we've added since the draft was saved
    deepMerge(target, source) {
      const output = { ...target };
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
      return output;
    },

    setupAutosave() {
      this.$watch('data', () => this.queueSave(), { deep: true });
      this.$watch('currentPhase', () => this.queueSave());
    },

    queueSave() {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.saveNow(), SAVE_DEBOUNCE_MS);
    },

    saveNow() {
      try {
        const payload = {
          currentPhase: this.currentPhase,
          data: this.data,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        this.showSaveIndicator();
      } catch (err) {
        console.warn('Could not save draft:', err);
      }
    },

    showSaveIndicator() {
      this.saveIndicator = 'Saved';
      setTimeout(() => { this.saveIndicator = ''; }, 2000);
    },

    /* ---------- Phase completion status ---------- */
    // Returns 'empty' | 'partial' | 'complete' for any phase number
    // 'complete' = every required field filled. Optional fields don't count.
    phaseStatus(phaseNum) {
      const d = this.data;

      switch (phaseNum) {
        case this.phaseNumbers.about: {
          // Required: name, valid email, role
          const reqs = [
            !!d.contactName,
            !!d.contactEmail && this.isValidEmail(d.contactEmail),
            !!d.contactRole,
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === 0) return 'empty';
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.business: {
          // Required: name, industry, pitch, description, USPs
          // + industryOther if industry === 'other'
          const reqs = [
            !!d.businessName,
            !!d.industry && (d.industry !== 'other' || !!d.industryOther),
            !!d.pitch,
            !!d.description,
            !!d.usps,
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === 0) return 'empty';
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.tone: {
          // Sliders have defaults. Required: brand feeling keywords.
          if (d.brandFeeling) return 'complete';
          // Touching voiceAvoid without brandFeeling = partial
          if (d.voiceAvoid) return 'partial';
          return 'empty';
        }

        case this.phaseNumbers.pages: {
          // Home is always pre-selected. Any selection beyond that = complete.
          // Just home alone still counts as valid ("landing page only" build).
          if (d.pagesNeeded.length === 0) return 'empty';
          return 'complete';
        }

        case this.phaseNumbers.content: {
          // Required: copywriting preference chosen + content for every selected page
          if (!d.copywritingPreference) return 'empty';
          const selected = this.selectedPagesList;
          if (selected.length === 0) return 'complete'; // edge case
          const pagesWithContent = selected.filter(p => (d.pageContent[p.slug] || '').trim()).length;
          if (pagesWithContent === 0) return 'partial';
          if (pagesWithContent === selected.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.brand: {
          // Two valid paths:
          // (a) status = 'starting-fresh' → complete, no other fields needed
          // (b) status = 'have' + primary colour + logo (upload OR link) + font preference
          if (d.brand.status === 'starting-fresh') return 'complete';
          if (d.brand.status !== 'have') {
            // Nothing touched at all
            const anyField = d.brand.primaryColour || d.brand.logoUploaded || d.brand.logoLink || d.brand.fontPreference;
            return anyField ? 'partial' : 'empty';
          }
          // They picked 'have' — now check the required fields
          const reqs = [
            !!d.brand.primaryColour,
            !!(d.brand.logoUploaded || d.brand.logoLink),
            !!d.brand.fontPreference,
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.audience: {
          // Required: audience description + photo asset status (any of 3 values counts, including 'none')
          const reqs = [
            !!d.audience.description,
            !!d.photography.assetStatus,
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === 0) return 'empty';
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.restaurant: {
          if (!this.isRestaurant) return 'empty';
          // Required: hours set on at least one day, menu (upload OR link),
          // booking platform, private dining answered
          const hasHours = Object.values(d.restaurant.openingHours).some(h => !h.closed && (h.lunch || h.dinner));
          const reqs = [
            hasHours,
            !!(d.restaurant.menuUploaded || d.restaurant.menuLink),
            !!d.restaurant.bookingPlatform,
            !!d.restaurant.privateDining,
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === 0) return 'empty';
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.contact: {
          // Required: address + domain ownership answered + existing-site question answered
          // (existingSiteUrl can be blank — we treat "blank" as "no existing site" valid answer
          //  but we need domain ownership explicitly selected)
          const reqs = [
            !!d.location.address,
            !!d.tech.domainOwned,
            // existingSite: "answered" means either a URL is given OR hasAdminWebsite question shown/skipped.
            // Since URL is optional (they might not have a site), we only require domainOwned as the tech anchor.
          ];
          const filled = reqs.filter(Boolean).length;
          if (filled === 0) return 'empty';
          if (filled === reqs.length) return 'complete';
          return 'partial';
        }

        case this.phaseNumbers.review: {
          return 'empty'; // Review has no fields
        }

        default:
          return 'empty';
      }
    },

    /* ---------- Sidebar navigation items ---------- */
    get sidebarItems() {
      const items = [
        { num: this.phaseNumbers.about,    key: 'about',    label: 'About you' },
        { num: this.phaseNumbers.business, key: 'business', label: 'Your business' },
        { num: this.phaseNumbers.tone,     key: 'tone',     label: 'Tone & feel' },
        { num: this.phaseNumbers.pages,    key: 'pages',    label: 'Pages needed' },
        { num: this.phaseNumbers.content,  key: 'content',  label: 'Page content' },
        { num: this.phaseNumbers.brand,    key: 'brand',    label: 'Brand & visuals' },
        { num: this.phaseNumbers.audience, key: 'audience', label: 'Audience & photos' },
      ];
      if (this.isRestaurant) {
        items.push({ num: this.phaseNumbers.restaurant, key: 'restaurant', label: 'Restaurant details' });
      }
      items.push({ num: this.phaseNumbers.contact, key: 'contact', label: 'Contact & tech' });
      items.push({ num: this.phaseNumbers.review,  key: 'review',  label: 'Review & submit' });
      return items;
    },

    sidebarMobileOpen: false,

    /* ---------- Navigation ---------- */
    advance() {
      this.currentPhase += 1;
      this.scrollToTop();
    },

    goBack() {
      if (this.currentPhase > 0) {
        this.currentPhase -= 1;
        this.scrollToTop();
      }
    },

    goToPhase(n) {
      this.currentPhase = n;
      this.scrollToTop();
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ---------- Computed helpers ---------- */
    get progressPercent() {
      if (this.currentPhase === 0) return 0;
      return Math.min(100, (this.currentPhase / this.totalPhases) * 100);
    },

    get isRestaurant() {
      return this.data.industry === 'restaurant';
    },

    // Dynamic phase number mapping.
    // Phase numbers change depending on whether restaurant block is included.
    // Non-restaurant: 1 About, 2 Business, 3 Tone, 4 Pages, 5 Content, 6 Brand, 7 Audience, 8 Contact/Tech, 9 Review
    // Restaurant:     1 About, 2 Business, 3 Tone, 4 Pages, 5 Content, 6 Brand, 7 Audience, 8 Restaurant, 9 Contact/Tech, 10 Review
    get phaseNumbers() {
      const seq = {
        welcome: 0,
        about: 1,
        business: 2,
        tone: 3,
        pages: 4,
        content: 5,
        brand: 6,
        audience: 7,
      };
      if (this.isRestaurant) {
        seq.restaurant = 8;
        seq.contact = 9;
        seq.review = 10;
      } else {
        seq.restaurant = -1; // never shown
        seq.contact = 8;
        seq.review = 9;
      }
      return seq;
    },

    // Pages available for current industry (filters out restaurant-only if not restaurant)
    get visiblePages() {
      return this.pageCatalogue.filter(p =>
        !p.restaurantOnly || this.isRestaurant
      );
    },

    // Pages selected by the user, in catalogue order
    get selectedPagesList() {
      return this.visiblePages.filter(p => this.data.pagesNeeded.includes(p.slug));
    },

    togglePage(slug, always) {
      if (always) return; // home can't be unchecked
      const idx = this.data.pagesNeeded.indexOf(slug);
      if (idx === -1) {
        this.data.pagesNeeded.push(slug);
      } else {
        this.data.pagesNeeded.splice(idx, 1);
      }
    },

    isPageSelected(slug) {
      return this.data.pagesNeeded.includes(slug);
    },

    /* ---------- Uploadcare helpers ---------- */
    openUploadcareDialog(targetField) {
      if (typeof uploadcare === 'undefined') {
        alert('Upload service not available. Please paste a link instead.');
        return;
      }
      const dialog = uploadcare.openDialog(null, {
        imagesOnly: targetField === 'logo' || targetField === 'photos',
        multiple: targetField === 'photos',
      });
      dialog.done(file => {
        if (file.files) {
          // multiple files
          file.files().forEach(f => {
            f.done(info => this.setUploadcareValue(targetField, info));
          });
        } else {
          file.done(info => this.setUploadcareValue(targetField, info));
        }
      });
    },

    setUploadcareValue(field, info) {
      const url = info.cdnUrl;
      switch (field) {
        case 'logo':            this.data.brand.logoUploaded = url; break;
        case 'brandGuidelines': this.data.brand.brandGuidelinesUploaded = url; break;
        case 'photos':          this.data.photography.photosUploaded = url; break;
        case 'menu':            this.data.restaurant.menuUploaded = url; break;
      }
    },

    /* ---------- Validation ---------- */
    get phase1Valid() {
      return !!(this.data.contactName && this.data.contactEmail && this.isValidEmail(this.data.contactEmail));
    },

    get phase2Valid() {
      if (!this.data.businessName || !this.data.industry || !this.data.pitch) return false;
      if (this.data.industry === 'other' && !this.data.industryOther) return false;
      return true;
    },

    get phase4Valid() {
      return this.data.pagesNeeded.length > 0;
    },

    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },

    /* ---------- Tone helpers ---------- */
    toneSummary(key) {
      const val = this.data.tone[key];
      if (val <= 2) return 'Leans left';
      if (val >= 4) return 'Leans right';
      return 'Balanced';
    },

    /* ---------- Markdown generation ---------- */
    generateMarkdown() {
      const d = this.data;
      const lines = [];

      lines.push(`# Website brief — ${d.businessName || '(unnamed)'}`);
      lines.push('');
      lines.push(`_Prepared via The Wonder Agency intake form. Submitted ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}._`);
      lines.push('');

      // Contact
      lines.push('## Primary contact');
      lines.push(`- **Name:** ${d.contactName}`);
      if (d.contactRole) lines.push(`- **Role:** ${d.contactRole}`);
      lines.push(`- **Email:** ${d.contactEmail}`);
      if (d.contactPhone) lines.push(`- **Phone:** ${d.contactPhone}`);
      if (d.additionalContacts) {
        lines.push('');
        lines.push('**Others in the loop:**');
        lines.push(d.additionalContacts);
      }
      lines.push('');

      // Business
      lines.push('## The business');
      lines.push(`- **Name:** ${d.businessName}`);
      const industryLabel = this.industryOptions.find(o => o.value === d.industry)?.label || d.industry;
      lines.push(`- **Industry:** ${industryLabel}${d.industry === 'other' && d.industryOther ? ` (${d.industryOther})` : ''}`);
      lines.push('');
      lines.push('**Elevator pitch:**  ');
      lines.push(d.pitch || '_Not provided._');
      lines.push('');
      if (d.description) {
        lines.push('**Fuller description:**  ');
        lines.push(d.description);
        lines.push('');
      }
      if (d.usps) {
        lines.push('**What makes them different:**  ');
        lines.push(d.usps);
        lines.push('');
      }

      // Tone
      lines.push('## Tone & feel');
      this.toneSliders.forEach(s => {
        const val = d.tone[s.key];
        const position = val === 3 ? 'centre' : (val < 3 ? `leans ${s.left.toLowerCase()}` : `leans ${s.right.toLowerCase()}`);
        lines.push(`- **${s.left} ↔ ${s.right}:** ${val}/5 (${position})`);
      });
      if (d.brandFeeling) {
        lines.push('');
        lines.push(`**Brand feeling in their words:** ${d.brandFeeling}`);
      }
      if (d.voiceAvoid) {
        lines.push('');
        lines.push(`**Avoid sounding like:** ${d.voiceAvoid}`);
      }
      lines.push('');

      // Pages
      lines.push('## Pages required');
      this.selectedPagesList.forEach(p => {
        lines.push(`- ${p.label}`);
      });
      if (d.customPages) {
        lines.push('');
        lines.push('**Additional custom pages:**  ');
        lines.push(d.customPages);
      }
      lines.push('');

      // Content per page
      lines.push('## Content per page');
      lines.push(d.copywritingPreference === 'client'
        ? '_Client is providing finished copy._'
        : '_Client has provided facts/bullets; Wonder Agency to write final copy._');
      lines.push('');
      this.selectedPagesList.forEach(p => {
        const content = d.pageContent[p.slug];
        lines.push(`### ${p.label}`);
        lines.push(content || '_No content provided yet._');
        lines.push('');
      });

      // Brand
      lines.push('## Brand & visuals');
      if (d.brand.status === 'starting-fresh') {
        lines.push('_Client does not yet have a brand identity — to be developed as part of the project._');
      } else {
        if (d.brand.primaryColour) lines.push(`- **Primary colour:** ${d.brand.primaryColour}`);
        if (d.brand.accentColour)  lines.push(`- **Accent colour:** ${d.brand.accentColour}`);
        if (d.brand.logoUploaded)  lines.push(`- **Logo (uploaded):** ${d.brand.logoUploaded}`);
        if (d.brand.logoLink)      lines.push(`- **Logo (link):** ${d.brand.logoLink}`);
        if (d.brand.brandGuidelinesUploaded) lines.push(`- **Brand guidelines (uploaded):** ${d.brand.brandGuidelinesUploaded}`);
        if (d.brand.brandGuidelinesLink)     lines.push(`- **Brand guidelines (link):** ${d.brand.brandGuidelinesLink}`);
        if (d.brand.fontPreference) {
          const fontLabels = { have: 'Has brand fonts', need: 'Needs help choosing', open: 'Open to recommendation' };
          lines.push(`- **Fonts:** ${fontLabels[d.brand.fontPreference] || d.brand.fontPreference}`);
        }
        if (d.brand.fontDetails) lines.push(`- **Font details:** ${d.brand.fontDetails}`);
      }
      lines.push('');

      // Audience & photography
      lines.push('## Audience');
      if (d.audience.description) lines.push(d.audience.description);
      if (d.audience.ageRange)    lines.push(`- **Age range:** ${d.audience.ageRange}`);
      if (d.audience.location)    lines.push(`- **Location / geography:** ${d.audience.location}`);
      lines.push('');

      lines.push('## Photography & video');
      const assetLabels = { have: 'Has finished assets', some: 'Has some, needs more', none: 'Needs everything' };
      if (d.photography.assetStatus) lines.push(`- **Status:** ${assetLabels[d.photography.assetStatus] || d.photography.assetStatus}`);
      if (d.photography.assetsLink) lines.push(`- **Assets link:** ${d.photography.assetsLink}`);
      if (d.photography.photosUploaded) lines.push(`- **Uploaded photos:** ${d.photography.photosUploaded}`);
      lines.push('');

      // Restaurant
      if (this.isRestaurant) {
        lines.push('## Restaurant details');
        lines.push('');
        lines.push('### Opening hours');
        lines.push('| Day | Lunch | Dinner | Notes |');
        lines.push('|-----|-------|--------|-------|');
        this.daysOfWeek.forEach(day => {
          const h = d.restaurant.openingHours[day.key];
          if (!h) return;
          if (h.closed) {
            lines.push(`| ${day.label} | Closed | Closed | ${h.notes || ''} |`);
          } else {
            lines.push(`| ${day.label} | ${h.lunch || '—'} | ${h.dinner || '—'} | ${h.notes || ''} |`);
          }
        });
        lines.push('');

        lines.push('### Menus');
        if (d.restaurant.menuUploaded) lines.push(`- **Menu (uploaded):** ${d.restaurant.menuUploaded}`);
        if (d.restaurant.menuLink)     lines.push(`- **Menu (link):** ${d.restaurant.menuLink}`);
        if (d.restaurant.menuChanges)  lines.push(`- **How often menus change:** ${d.restaurant.menuChanges}`);
        if (d.restaurant.menuContact)  lines.push(`- **Who sends menu updates:** ${d.restaurant.menuContact}`);
        if (d.restaurant.dietaryFilters) lines.push(`- **Dietary info:** ${d.restaurant.dietaryFilters}`);
        lines.push('');

        lines.push('### Booking & reservations');
        const platformLabel = this.bookingPlatforms.find(p => p.value === d.restaurant.bookingPlatform)?.label || d.restaurant.bookingPlatform;
        if (platformLabel) lines.push(`- **Platform:** ${platformLabel}`);
        if (d.restaurant.bookingLink) lines.push(`- **Booking link:** ${d.restaurant.bookingLink}`);
        if (d.restaurant.walkInPolicy) lines.push(`- **Walk-in policy:** ${d.restaurant.walkInPolicy}`);
        if (d.restaurant.groupSizeLimit) lines.push(`- **Group size limit:** ${d.restaurant.groupSizeLimit}`);
        lines.push('');

        if (d.restaurant.privateDining === 'yes') {
          lines.push('### Private dining');
          if (d.restaurant.pdCapacities) lines.push(`- **Capacities:** ${d.restaurant.pdCapacities}`);
          if (d.restaurant.pdPricing)    lines.push(`- **Pricing / minimum spend:** ${d.restaurant.pdPricing}`);
          if (d.restaurant.pdEventTypes) lines.push(`- **Event types:** ${d.restaurant.pdEventTypes}`);
          lines.push('');
        }
      }

      // Contact & location
      lines.push('## Location & contact');
      if (d.location.address) lines.push(`- **Address:** ${d.location.address}`);
      lines.push(`- **Map embed:** ${d.location.showMap === 'yes' ? 'Yes, include a map' : 'No map needed'}`);
      lines.push('');

      // Social
      const socialEntries = Object.entries(d.socials).filter(([k, v]) => v);
      if (socialEntries.length) {
        lines.push('## Social media');
        socialEntries.forEach(([k, v]) => {
          const label = k.charAt(0).toUpperCase() + k.slice(1);
          lines.push(`- **${label}:** ${v}`);
        });
        lines.push('');
      }

      if (d.press) {
        lines.push('## Press & awards');
        lines.push(d.press);
        lines.push('');
      }

      if (d.referenceSites) {
        lines.push('## Reference sites');
        lines.push(d.referenceSites);
        lines.push('');
      }

      // Technical
      lines.push('## Technical & access');
      const accessLabels = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
      if (d.tech.domainOwned)       lines.push(`- **Domain owned:** ${accessLabels[d.tech.domainOwned] || d.tech.domainOwned}`);
      if (d.tech.domainProvider)    lines.push(`- **Domain provider:** ${d.tech.domainProvider}`);
      if (d.tech.hasAdminDomain)    lines.push(`- **Admin access to domain hosting:** ${accessLabels[d.tech.hasAdminDomain] || d.tech.hasAdminDomain}`);
      if (d.tech.existingSiteUrl)   lines.push(`- **Existing website:** ${d.tech.existingSiteUrl}`);
      if (d.tech.hasAdminWebsite)   lines.push(`- **Admin access to existing website:** ${accessLabels[d.tech.hasAdminWebsite] || d.tech.hasAdminWebsite}`);
      if (d.tech.emailHosting)      lines.push(`- **Email hosting:** ${d.tech.emailHosting}`);
      if (d.tech.platformPreference) lines.push(`- **Platform preference:** ${d.tech.platformPreference}`);
      if (d.tech.analytics)         lines.push(`- **Analytics:** ${d.tech.analytics}`);
      lines.push('');
      lines.push('_Credentials will be shared separately via secure channel once the project kicks off — not in this form._');
      lines.push('');

      if (d.anythingElse) {
        lines.push('## Anything else');
        lines.push(d.anythingElse);
        lines.push('');
      }

      return lines.join('\n');
    },

    async copyBrief() {
      const md = this.generateMarkdown();
      try {
        await navigator.clipboard.writeText(md);
        this.copyFeedback = 'Copied to clipboard';
        setTimeout(() => { this.copyFeedback = ''; }, 3000);
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = md;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          this.copyFeedback = 'Copied to clipboard';
          setTimeout(() => { this.copyFeedback = ''; }, 3000);
        } catch (e) {
          this.copyFeedback = 'Copy failed — please select and copy manually';
        }
        document.body.removeChild(textarea);
      }
    },

    /* ---------- Submission ---------- */
    async submitBrief() {
      this.submitting = true;
      this.submitError = '';

      const payload = {
        submittedAt: new Date().toISOString(),
        businessName: this.data.businessName,
        contactName: this.data.contactName,
        contactEmail: this.data.contactEmail,
        markdown: this.generateMarkdown(),
        raw: this.data,
      };

      try {
        if (SUBMIT_ENDPOINT && SUBMIT_ENDPOINT !== 'YOUR_APPS_SCRIPT_ENDPOINT_URL') {
          const response = await fetch(SUBMIT_ENDPOINT, {
            method: 'POST',
            // Apps Script web-apps require 'text/plain' to avoid CORS preflight
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error(`Server returned ${response.status}`);
        } else {
          console.warn('SUBMIT_ENDPOINT not configured. Payload:', payload);
          // Simulate for dev
          await new Promise(r => setTimeout(r, 800));
        }
        this.submitted = true;
        // Clear saved draft on successful submit
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
      } catch (err) {
        console.error('Submission failed:', err);
        this.submitError = 'Submission failed. Please try again, or copy the brief and email it to us directly.';
      } finally {
        this.submitting = false;
      }
    },
  };
}
