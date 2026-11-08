/* ============================================================
   Me&Co.: discovery brief, as data
   ------------------------------------------------------------
   The studio's real creative brief has 13
   numbered sections. Every one of them is present below, nothing
   dropped. Section 4 (content change frequency) is the only one
   that does not get a screen of its own: it rides along with
   section 10 (pain points), because "how often does this change"
   and "what breaks when we change it" are the same conversation
   and asking them on two separate screens made the flow read as
   busywork. Twelve answering steps, plus a cover and a review.

   ONE FORM, TWO VARIANTS, not two forms. A nonprofit and a
   locksmith need the same thirteen sections. What differs is the
   vocabulary inside five of them (donations and volunteers versus
   quotes and bookings), so those five sections carry a `variants`
   block and everything else is written once. Adding a third client
   type later is a new key in `variants`, not a new file.

   Field types the renderer knows about:
     short    single line input
     email    single line, type=email
     url      single line, type=url
     date     single line, type=date
     long     textarea
     pick     choose exactly one from options
     choose   choose any number from options, plus a free text "other"
     pages    the section 9 widget: pick up to five pages, then fill
              in goal, CTA and required content for each one picked
   ============================================================ */

const PAGE_OPTIONS_SHARED = ['Home', 'About', 'Contact', 'Events', 'Resources', 'Blog or News'];
const PAGE_OPTIONS_NONPROFIT = ['Programs or Services', 'Donate', 'Volunteer', 'Partners or Sponsors'];
const PAGE_OPTIONS_BUSINESS = ['Services', 'Service Areas', 'Pricing', 'Reviews'];

/* Sections written once, used by every client type. */
function sharedSections() {
  return [
    {
      id: 'org',
      number: 1,
      title: 'Who you are',
      kicker: 'Section 01',
      blurb: 'The basics, in your own words. No polish needed, we will do that part.',
      fields: [
        { id: 'org_name', type: 'short', label: 'Organization name', required: true },
        { id: 'contact_name', type: 'short', label: 'Primary point of contact, name and role', required: true },
        { id: 'contact_email', type: 'email', label: 'Best email for that person', required: true },
        { id: 'mission', type: 'long', label: 'Mission statement', help: 'One or two sentences.' },
        { id: 'about', type: 'long', label: 'Short "about" summary', help: 'Roughly 50 to 120 words. Plain language beats a mission-speak paragraph.' },
        { id: 'who_you_serve', type: 'long', label: 'Who you serve', help: 'Community, geography, who actually shows up.' },
        { id: 'programs', type: 'long', label: 'Core programs or services', help: 'A list, one sentence each.' },
        { id: 'funding', type: 'long', label: 'How you are currently funded' },
      ],
    },
    {
      id: 'current',
      number: 2,
      title: 'Where you are now',
      kicker: 'Section 02',
      blurb: 'What exists today, what is going wrong with it, and what is worth keeping.',
      fields: [
        { id: 'current_url', type: 'url', label: 'Current website address', placeholder: 'https://' },
        {
          id: 'platform_problems',
          type: 'choose',
          label: 'What is the problem with the current platform',
          options: [
            'Hard to update', 'Design limitations', 'Slow site', 'Unclear messaging',
            'Broken forms', 'Unreliable emails', 'Poor donation or checkout flow',
            'Not mobile friendly', 'Hard to scale',
          ],
        },
        {
          id: 'why_now',
          type: 'choose',
          label: 'What prompted this project now',
          options: ['New season', 'New programs', 'Fundraising push', 'Leadership change', 'Credibility needs', 'Rebrand'],
        },
        { id: 'keep', type: 'long', label: 'What is working today that we should preserve', help: 'Certain pages, messaging, photos, forms, a donation or payment link you already trust.' },
        { id: 'confusion_examples', type: 'long', label: 'Two or three moments where the current site caused confusion or lost you someone', help: 'This is the single most useful answer on this whole page. A real story beats a category.' },
      ],
    },
    {
      id: 'goals',
      number: 3,
      title: 'What this site has to do',
      kicker: 'Section 03',
      blurb: 'Pick your top three. A site that tries to do nine things does none of them.',
      fields: [
        {
          id: 'primary_purpose',
          type: 'pick',
          label: 'Primary purpose',
          options: ['Awareness', 'Credibility', 'Education', 'Fundraising', 'Community access', 'Recruiting'],
        },
        { id: 'success_90', type: 'long', label: 'Define success in 90 days', help: 'A number if you can get one. Plus 20 donations a month, plus 5 volunteer leads, plus 30 email signups.' },
      ],
    },
    {
      id: 'audience',
      number: 4,
      title: 'Who it is for',
      kicker: 'Section 05',
      blurb: 'Not "everyone". The two or three groups who actually decide whether this works.',
      fields: [
        { id: 'audience_confidence', type: 'long', label: 'What does each audience need in order to feel confident taking action', help: 'Proof of impact, clarity of services, an easy payment flow, a contact path, legitimacy signals.' },
        { id: 'accessibility', type: 'long', label: 'Any language or accessibility considerations', help: 'Multi-language needs, simple reading level, mostly mobile users.' },
      ],
    },
    {
      id: 'cta',
      number: 5,
      title: 'What you want people to do',
      kicker: 'Section 06',
      blurb: 'Every page needs one obvious next move. This is where we decide what it is.',
      fields: [
        { id: 'cta_after', type: 'long', label: 'What should happen after each action', help: 'Confirmation message, auto email receipt, follow up timeline, routing to the right person.' },
      ],
    },
    {
      id: 'story',
      number: 6,
      title: 'Your story and your proof',
      kicker: 'Section 07',
      blurb: 'The words and the evidence. Copy is the number one launch date killer, so anything you can give us here moves the date forward.',
      fields: [
        { id: 'key_message', type: 'long', label: 'Key message in one sentence', help: 'Plain language, no insider terms. Say it the way you would say it out loud.' },
        { id: 'proof', type: 'long', label: 'Proof', help: 'Stats, outcomes, testimonials, before and after stories, annual report highlights.' },
        { id: 'program_explain', type: 'long', label: 'Program or service explanations', help: 'Who it is for, how it works, eligibility, how to sign up, what to expect next.' },
        { id: 'trust', type: 'long', label: 'Trust builders', help: 'Partner logos, press mentions, leadership bios, financial transparency, FAQs.' },
      ],
    },
    {
      id: 'design',
      number: 7,
      title: 'Look and feel',
      kicker: 'Section 08',
      blurb: 'Tell us what you like and, just as usefully, what makes you wince.',
      fields: [
        {
          id: 'vibe',
          type: 'choose',
          label: 'Visual vibe words',
          options: ['Modern', 'Warm', 'Bold', 'Calm', 'Grassroots', 'Premium', 'Hopeful', 'Minimalist', 'Youth focused', 'Dignified'],
        },
        {
          id: 'font_direction',
          type: 'pick',
          label: 'Font direction',
          options: ['Clean and modern', 'Editorial and elegant', 'Friendly and approachable', 'Bold and activist'],
        },
        { id: 'colors', type: 'long', label: 'Colour inspiration', help: 'Colours you like, colours to avoid, and any existing brand colours we must hold to.' },
        { id: 'inspiration_links', type: 'long', label: 'Three to eight websites you love, and what you love about each', help: 'One per line. "What you love about it" is the half that actually saves revision rounds.' },
        { id: 'avoid', type: 'long', label: 'If you have no examples, describe what to avoid', help: 'Sites that feel too corporate, too busy, or too generic.' },
      ],
    },
    {
      id: 'pages',
      number: 8,
      title: 'Pages at launch',
      kicker: 'Section 09',
      blurb: 'Choose up to five. Five real pages beat twelve half-written ones, and page six can always come later.',
      fields: [
        { id: 'launch_pages', type: 'pages', label: 'Pick up to five pages, then say what each one is for', max: 5 },
      ],
    },
    {
      id: 'pain',
      number: 9,
      title: 'What breaks, and how often it changes',
      kicker: 'Sections 04 and 10',
      blurb: 'Two questions that are really one conversation: what you need to change yourself, and what goes wrong today when you try.',
      fields: [
        {
          id: 'change_frequency',
          type: 'pick',
          label: 'How often will content change',
          options: ['Rarely, roughly quarterly', 'Sometimes, roughly monthly', 'Often, roughly weekly'],
        },
        {
          id: 'change_types',
          type: 'choose',
          label: 'What types of content change most',
          options: ['Events', 'Programs', 'Photos', 'Impact stats', 'Leadership bios', 'Blog or news', 'Resources'],
        },
        {
          id: 'who_updates',
          type: 'choose',
          label: 'Who typically provides updates',
          options: ['Staff', 'Volunteer', 'Board member', 'Contractor'],
        },
        {
          id: 'form_issues',
          type: 'choose',
          label: 'Forms and email issues',
          options: ['Submissions not delivered', 'No confirmation emails', 'Spam', 'Goes to the wrong inbox', 'No tracking'],
        },
        {
          id: 'comms_issues',
          type: 'choose',
          label: 'Communication issues',
          options: ['Newsletter signup not syncing', 'Duplicate contacts', 'No tagging of people', 'No welcome sequence'],
        },
        {
          id: 'content_issues',
          type: 'choose',
          label: 'Content update issues',
          options: ['Hard to update', 'Site breaks when edited', 'Too many scattered tools'],
        },
      ],
    },
    {
      id: 'integrations',
      number: 10,
      title: 'Tools you already use',
      kicker: 'Section 11',
      blurb: 'If you are not sure, just list what is in use today. We will work out what connects to what.',
      fields: [
        { id: 'email_marketing', type: 'choose', label: 'Email marketing', options: ['Mailchimp', 'ConvertKit or Kit', 'Constant Contact'] },
        { id: 'crm', type: 'choose', label: 'CRM or contact tracking', options: ['HubSpot', 'Airtable', 'Salesforce', 'Bloomerang'] },
        { id: 'events_tool', type: 'choose', label: 'Events', options: ['Eventbrite', 'In-house RSVP'] },
        { id: 'scheduling', type: 'choose', label: 'Scheduling', options: ['Calendly', 'Acuity'] },
        { id: 'other_tools', type: 'long', label: 'Anything else', help: 'Volunteer tools, application systems, Google Sheets, Zapier or Make.' },
      ],
    },
    {
      id: 'assets',
      number: 11,
      title: 'What you already have',
      kicker: 'Section 12',
      blurb: 'Tick what exists. Nothing here is a wrong answer, and gaps are useful to know now rather than in week three.',
      fields: [
        { id: 'logo', type: 'choose', label: 'Logo files', options: ['SVG', 'PNG', 'Only a JPG or a screenshot', 'Nothing usable'] },
        { id: 'brand_elements', type: 'choose', label: 'Brand elements', options: ['Colour codes', 'Font files or names', 'A written brand guide'] },
        { id: 'photos', type: 'choose', label: 'Photos you own', options: ['Events', 'Programs or work in progress', 'Community or customers', 'Leadership or team'] },
        { id: 'videos', type: 'long', label: 'Videos', help: 'YouTube or Vimeo links, reels, interviews.' },
        { id: 'impact_docs', type: 'long', label: 'Documents', help: 'Annual report, one-pagers, flyers, PDFs.' },
        { id: 'testimonials', type: 'long', label: 'Testimonials', help: 'Quotes, stories, partner endorsements. Paste them straight in if you have them.' },
        { id: 'partner_logos', type: 'long', label: 'Partner or sponsor logos', help: 'Who, and do you have the files.' },
      ],
    },
    {
      id: 'constraints',
      number: 12,
      title: 'Timing and reality',
      kicker: 'Section 13',
      blurb: 'The honest version. A real constraint named now is a problem we design around, not one we discover.',
      fields: [
        { id: 'launch_date', type: 'date', label: 'Target launch date' },
        { id: 'launch_tied_to', type: 'short', label: 'Is it tied to an event, campaign or deadline', placeholder: 'Or leave blank if the date is flexible' },
        { id: 'budget', type: 'short', label: 'Budget range, if you know it' },
        { id: 'must_haves', type: 'long', label: 'Must haves versus nice to haves' },
        { id: 'capacity', type: 'long', label: 'Internal capacity constraints', help: 'Limited approval time, missing photos or copy, slow review cycles. Say it plainly, it changes the plan.' },
      ],
    },
  ];
}

/* The five sections whose vocabulary genuinely differs by client type.
   Keyed by section id, then by variant. Anything not listed here is
   identical for every client. */
const VARIANT_FIELDS = {
  org: {
    nonprofit: {},
    business: {
      mission: { label: 'What the business does, in one or two sentences' },
      who_you_serve: { label: 'Who you serve', help: 'Customer type, geography, service area.' },
      funding: { label: 'How the business makes money', help: 'Jobs, callouts, contracts, retail, recurring service.' },
    },
  },
  goals: {
    nonprofit: {
      top_goals: {
        type: 'choose',
        label: 'Top website goals, pick your top three',
        options: [
          'Donations', 'Monthly giving', 'Volunteer signups', 'Program enrollment or applications',
          'Event attendance', 'Partnerships or sponsorships', 'Newsletter growth', 'Grant credibility', 'Media inquiries',
        ],
      },
    },
    business: {
      top_goals: {
        type: 'choose',
        label: 'Top website goals, pick your top three',
        options: [
          'Quote requests', 'Phone calls', 'Online bookings', 'Emergency or same day jobs',
          'Repeat customers', 'Commercial or contract accounts', 'Newsletter growth', 'Reviews and reputation', 'Media inquiries',
        ],
      },
    },
  },
  audience: {
    nonprofit: {
      audiences: {
        type: 'choose',
        label: 'Who are the main audiences',
        options: ['Donors', 'Volunteers', 'Community members receiving services', 'Partners or sponsors', 'Grant makers', 'Media'],
      },
    },
    business: {
      audiences: {
        type: 'choose',
        label: 'Who are the main audiences',
        options: ['Homeowners', 'Businesses and property managers', 'Repeat customers', 'Referral partners', 'Emergency callers', 'Media'],
      },
    },
  },
  cta: {
    nonprofit: {
      actions: {
        type: 'choose',
        label: 'What actions should visitors take',
        options: ['Donate', 'Give monthly', 'Volunteer', 'Apply or get help', 'Attend events', 'Partner or sponsor', 'Contact'],
      },
      money_cta: {
        type: 'pick',
        label: 'Donation call to action preference',
        options: ['Donate Now', 'Give Monthly', 'Sponsor a Program', 'Give in Honor or Memory'],
      },
      people_cta: {
        type: 'pick',
        label: 'Volunteer call to action preference',
        options: ['Join a Volunteer Day', 'Ongoing Roles', 'Skills-based Volunteering'],
      },
    },
    business: {
      actions: {
        type: 'choose',
        label: 'What actions should visitors take',
        options: ['Call now', 'Request a quote', 'Book a time', 'Emergency service', 'See service areas', 'Leave a review', 'Contact'],
      },
      money_cta: {
        type: 'pick',
        label: 'Primary call to action preference',
        options: ['Call Now', 'Get a Free Quote', 'Book a Time', '24 Hour Emergency'],
      },
      people_cta: {
        type: 'pick',
        label: 'Secondary call to action preference',
        options: ['Join the Mailing List', 'Request a Callback', 'Ask a Question'],
      },
    },
  },
  pain: {
    nonprofit: {
      money_flow_issues: {
        type: 'choose',
        label: 'Donation flow issues',
        options: ['Buried button', 'Unclear confirmation', 'Confusing recurring giving', 'Page feels untrustworthy'],
      },
      intake_issues: {
        type: 'choose',
        label: 'Volunteer and program intake issues',
        options: ['No follow up', 'No segmentation', 'No automated next steps'],
      },
    },
    business: {
      money_flow_issues: {
        type: 'choose',
        label: 'Quote and payment flow issues',
        options: ['Phone number hard to find', 'Unclear confirmation', 'No online payment option', 'Page feels untrustworthy'],
      },
      intake_issues: {
        type: 'choose',
        label: 'Quote and booking intake issues',
        options: ['No follow up', 'No way to tell job types apart', 'No automated next steps'],
      },
    },
  },
  integrations: {
    nonprofit: {
      money_tool: {
        type: 'choose',
        label: 'Donations',
        options: ['Stripe', 'PayPal', 'Donorbox', 'Givebutter', 'Classy', 'Network for Good', 'Zeffy', 'every.org'],
      },
    },
    business: {
      money_tool: {
        type: 'choose',
        label: 'Payments and invoicing',
        options: ['Stripe', 'PayPal', 'Square', 'QuickBooks', 'Invoices by hand'],
      },
    },
  },
  assets: { nonprofit: {}, business: {} },
};

/* Field ordering per section, so variant-only fields land in the right
   place rather than always at the end. Only sections that have
   variant-only fields need an entry. */
const FIELD_ORDER = {
  goals: ['primary_purpose', 'top_goals', 'success_90'],
  audience: ['audiences', 'audience_confidence', 'accessibility'],
  cta: ['actions', 'money_cta', 'people_cta', 'cta_after'],
  pain: [
    'change_frequency', 'change_types', 'who_updates',
    'form_issues', 'money_flow_issues', 'intake_issues', 'comms_issues', 'content_issues',
  ],
  integrations: ['money_tool', 'email_marketing', 'crm', 'events_tool', 'scheduling', 'other_tools'],
};

const VARIANTS = {
  nonprofit: {
    key: 'nonprofit',
    label: 'Nonprofit or community organization',
    coverTitle: 'Tell us what this site has to do for the people you serve.',
    coverSub: 'A real creative brief, in thirteen short sections. Answer what you can, skip what you cannot, come back to the rest.',
    pageOptions: PAGE_OPTIONS_SHARED.concat(PAGE_OPTIONS_NONPROFIT),
  },
  business: {
    key: 'business',
    label: 'Business or service provider',
    coverTitle: 'Tell us what this site has to do for your customers.',
    coverSub: 'A real creative brief, in thirteen short sections. Answer what you can, skip what you cannot, come back to the rest.',
    pageOptions: PAGE_OPTIONS_SHARED.concat(PAGE_OPTIONS_BUSINESS),
  },
};

function resolveVariant(name) {
  return VARIANTS[name] ? name : 'nonprofit';
}

/* Merge the shared sections with the variant overrides and return the
   real step list the renderer walks. Pure function, no side effects, so
   the verification script can diff two variants directly. */
function buildBrief(variantName) {
  const variant = resolveVariant(variantName);
  const meta = VARIANTS[variant];
  const sections = sharedSections().map((section) => {
    const overrides = (VARIANT_FIELDS[section.id] && VARIANT_FIELDS[section.id][variant]) || {};
    const byId = {};
    section.fields.forEach((f) => {
      byId[f.id] = Object.assign({}, f, overrides[f.id] || {});
    });
    // Variant-only fields that have no shared counterpart.
    Object.keys(overrides).forEach((id) => {
      if (!byId[id]) byId[id] = Object.assign({ id }, overrides[id]);
    });
    const order = FIELD_ORDER[section.id] || section.fields.map((f) => f.id);
    const ordered = order.filter((id) => byId[id]).map((id) => byId[id]);
    // Anything not named in the order list still gets rendered, at the
    // end, so a future field can never be silently invisible.
    Object.keys(byId).forEach((id) => {
      if (order.indexOf(id) === -1) ordered.push(byId[id]);
    });
    const fields = ordered.map((f) =>
      f.type === 'pages' ? Object.assign({}, f, { options: meta.pageOptions }) : f
    );
    return Object.assign({}, section, { fields });
  });
  return { variant, meta, sections };
}

module.exports = { buildBrief, VARIANTS, resolveVariant };
