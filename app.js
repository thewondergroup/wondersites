/* =========================================================
   Wonder Agency · Project intake — app logic
   ========================================================= */

const STORAGE_KEY = 'wonder_intake_v1';
const SAVE_DEBOUNCE_MS = 400;

function wonderIntake() {
  return {
    /* ---------- Navigation state ---------- */
    currentPhase: 0,
    totalPhases: 10, // Phase 0 (welcome) doesn't count towards the 10
    hasDraft: false,
    dismissedResume: false,
    saveIndicator: '',
    _saveTimer: null,

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

      // Remaining phases to be added in next pass.
      // Structure placeholders so localStorage shape is consistent.
      pagesNeeded: [],
      pagesContent: {},
      copywritingPreference: '', // 'client' | 'wonder'
      brand: {
        primaryColour: '',
        accentColour: '',
        logoUrl: '',
        logoUploadcare: '',
        brandGuidelinesUrl: '',
        fontPreference: '',
      },
      audience: '',
      photography: {
        hasAssets: '',
        assetsUrl: '',
        shootNeeded: false,
      },
      // Restaurant-only
      openingHours: {},
      menus: {},
      booking: {},
      privateDining: {},
      // Contact & location
      address: '',
      socials: {},
      press: '',
      referenceSites: '',
      // Technical
      tech: {
        domainOwned: '',
        domainAccess: '',
        existingSite: '',
        websiteAccess: '',
        emailHosting: '',
        platformPreference: '',
        analytics: '',
      },
      timeline: {
        launchDate: '',
        budget: '',
      },
      anythingElse: '',
    },

    /* ---------- Static options ---------- */
    industryOptions: [
      { value: 'restaurant',       label: 'Restaurant & Hospitality' },
      { value: 'hotel',            label: 'Hotel / Stay' },
      { value: 'retail',           label: 'Retail & E-commerce' },
      { value: 'design-studio',    label: 'Design & Creative Studio' },
      { value: 'professional',     label: 'Professional Services' },
      { value: 'wellness',         label: 'Wellness / Beauty' },
      { value: 'other',            label: 'Something else' },
    ],

    toneSliders: [
      { key: 'formalCasual',      left: 'Formal',       right: 'Casual' },
      { key: 'seriousPlayful',    left: 'Serious',      right: 'Playful' },
      { key: 'understatedBold',   left: 'Understated',  right: 'Bold' },
      { key: 'traditionalModern', left: 'Traditional',  right: 'Modern' },
    ],

    phaseLabels: [
      'Welcome',
      'About you',
      'Your business',
      'Tone & feel',
      'Pages needed',
      'Page content',
      'Brand & visuals',
      'Audience & photography',
      'Restaurant details',
      'Contact, tech & timeline',
      'Review & submit',
    ],

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
      // Consider a draft meaningful if any text field has been filled
      return !!(
        data.contactName || data.businessName || data.pitch ||
        data.description || data.contactEmail
      );
    },

    resumeDraft() {
      if (this._pendingDraft) {
        // Merge saved data into current structure (preserves any new fields we've added since)
        this.data = { ...this.data, ...this._pendingDraft.data };
        this.data.tone = { ...this.data.tone, ...(this._pendingDraft.data.tone || {}) };
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

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ---------- Computed ---------- */
    get progressPercent() {
      if (this.currentPhase === 0) return 0;
      return Math.min(100, (this.currentPhase / this.totalPhases) * 100);
    },

    get currentPhaseLabel() {
      return this.phaseLabels[this.currentPhase] || '';
    },

    get isRestaurant() {
      return this.data.industry === 'restaurant';
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

    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
  };
}
