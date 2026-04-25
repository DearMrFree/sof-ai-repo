import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
} from 'ai'
import * as z from 'zod'

export const maxDuration = 60

// Complete AI1 Knowledge Base
const AI1_KNOWLEDGE = {
  company: {
    name: "All In One (AI1)",
    founded: 1996,
    yearsInBusiness: new Date().getFullYear() - 1996,
    location: "531 Lasuen Mall #20051, Stanford, CA 94305",
    phone: "(408) 872-8340",
    phoneRaw: "4088728340",
    email: "luxservicesbayarea@gmail.com",
    tagline: "Luxury at Your Doorstep",
    description: "Premium home services in the San Francisco Bay Area with a focus on quality and customer satisfaction. We serve high-net-worth individuals and corporate clients since 1996.",
    coverage: "$2M liability insurance",
    certifications: ["BBB A+ Rating", "AMSA ProMover Certified", "Background-Checked Professionals"],
    socialMedia: {
      instagram: "https://instagram.com/allinonebayarea",
      tiktok: "https://tiktok.com/@allinonebayarea"
    },
    stats: {
      clients: "2,500+",
      retentionRate: "98%",
      valueHandled: "$15M+",
      responseTime: "24hr",
      countries: 12,
      corporateClients: 156
    }
  },

  pages: {
    home: { path: "/", description: "Homepage with company overview, services, testimonials, global presence map, and contact form" },
    services: { path: "/#services", description: "Complete list of all services for private and corporate clients" },
    about: { path: "/#about", description: "About section with company history and values" },
    contact: { path: "/#contact", description: "Contact form and company contact information" },
    globalPresence: { path: "/#global-presence", description: "Interactive 3D globe showing client locations worldwide" },
    quote: { path: "/quote", description: "Request a bespoke proposal with our 6-step wizard" },
    clientPortal: { path: "/client-portal", description: "Client portal to view service requests and account" },
    adminPortal: { path: "/admin", description: "Administrator portal for managing requests (staff only)" },
    videoStudio: { path: "/video-studio", description: "AI-powered video generation studio for marketing" },
  },

  sections: {
    hero: "Hero section with company tagline, trust badges, and call to action",
    stats: "Statistics showing 2,500+ clients, 98% retention, $15M+ handled, 24hr response",
    process: "4-step process: Consultation, Custom Plan, Expert Execution, Results",
    corporate: "Dedicated section for corporate and enterprise clients",
    testimonials: "Client testimonials from executives and high-net-worth individuals",
    awards: "Industry awards and press mentions from Forbes, WSJ, Bloomberg",
    faq: "Frequently asked questions about services, pricing, and process",
  },

  services: {
    private: [
      {
        id: "white-glove-relocation",
        title: "White-Glove Relocation",
        subtitle: "Residential Moving",
        description: "Your home, your history, your heirlooms — moved with the reverence they deserve. Custom hand-wrapped packing, climate-controlled transport, fine art specialists, and up to $2M coverage.",
        features: ["Custom hand-wrapped packing", "Climate-controlled transport", "Fine art & piano specialists", "Same-day settling service", "Up to $2M coverage"],
        tag: "Most Requested"
      },
      {
        id: "fine-art-handling",
        title: "Fine Art & Valuables Handling",
        subtitle: "Specialty Transport",
        description: "Museum-grade crating and packing for sculptures, paintings, wine collections. GPS-tracked, climate-controlled, with full provenance documentation.",
        features: ["Museum-grade crating", "Climate & humidity control", "GPS-tracked vehicles", "International shipping"],
        tag: null
      },
      {
        id: "estate-landscaping",
        title: "Estate Landscaping",
        subtitle: "Curated Grounds Design",
        description: "Master landscape architect consultation, bespoke seasonal planting, smart irrigation, hardscape design, and ongoing estate maintenance.",
        features: ["Master architect consultation", "Seasonal planting programmes", "Smart irrigation", "Water features"],
        tag: null
      },
      {
        id: "property-concierge",
        title: "Property Concierge",
        subtitle: "Complete Home Management",
        description: "One point of contact for every property need. Dedicated estate manager, 24/7 emergency response, vendor coordination, seasonal preparation.",
        features: ["Dedicated estate manager", "24/7 emergency line", "Vendor network", "Pre-arrival service"],
        tag: "Exclusive"
      },
      {
        id: "surface-restoration",
        title: "Surface & Exterior Restoration",
        subtitle: "Pressure Washing & Detailing",
        description: "Restore driveways, stonework, decks, and facade to showroom condition with precision cleaning technology and eco-certified solutions.",
        features: ["Soft-wash & high-pressure", "Natural stone specialist", "Eco-certified solutions", "Bi-annual programmes"],
        tag: null
      },
      {
        id: "gutter-roof-care",
        title: "Gutter & Roof Care",
        subtitle: "Preventive Protection",
        description: "Comprehensive gutter inspection, cleaning, minor repairs, and preventive maintenance to protect against water damage.",
        features: ["Full system inspection", "Downspout clearing", "Minor repairs", "Annual contracts"],
        tag: null
      },
    ],
    corporate: [
      {
        id: "corporate-relocation",
        title: "Corporate Relocation",
        subtitle: "Office & Commercial Moving",
        description: "Enterprise-scale moves with zero operational disruption. Dedicated project manager, after-hours scheduling, IT infrastructure handling.",
        features: ["Dedicated project manager", "After-hours scheduling", "IT infrastructure", "Compliance documentation"],
        tag: "Corporate"
      },
      {
        id: "executive-relocation",
        title: "Executive Relocation Programme",
        subtitle: "C-Suite Moving",
        description: "White-glove, door-to-door relocation for top talent with personal coordination, discretion, and zero-compromise standards.",
        features: ["Personal coordinator", "Private transport", "Settling-in services", "Strict NDA"],
        tag: "Executive"
      },
      {
        id: "facility-management",
        title: "Facility Management Services",
        subtitle: "Commercial Maintenance",
        description: "Keep corporate campuses immaculate with ongoing grounds maintenance, exterior cleaning, and reactive property services.",
        features: ["Commercial landscaping", "Pressure washing", "Emergency response", "Quarterly reporting"],
        tag: null
      },
      {
        id: "debris-clearance",
        title: "Debris & Site Clearance",
        subtitle: "Commercial Hauling",
        description: "Construction sites and office fit-outs with industrial capacity. E-waste destruction, LEED-compliant disposal documentation.",
        features: ["Same-day capacity", "E-waste destruction", "Recycling coordination", "LEED compliance"],
        tag: null
      },
    ]
  },

  faq: [
    { q: "What areas do you serve?", a: "We serve the entire San Francisco Bay Area including SF, Peninsula, South Bay, East Bay, and North Bay. We also handle international relocations and have served clients in 12 countries." },
    { q: "How do I get a quote?", a: "Visit our quote page at /quote to complete our 6-step proposal wizard. A senior advisor will prepare a bespoke proposal within 24 hours. No pricing is displayed online — all quotes are customized to your specific needs." },
    { q: "Do you serve corporate clients?", a: "Yes! We have a dedicated corporate division serving Fortune 500 companies, tech startups, and institutions. Services include corporate relocation, executive moving, and facility management." },
    { q: "What makes AI1 different?", a: "We've been serving the Bay Area since 1996 with a focus on luxury, white-glove service. We carry $2M liability coverage, are BBB A+ rated, and all staff are background-checked. Our 98% client retention rate speaks to our quality." },
    { q: "How do I create an account?", a: "Click the Sign In button in the top navigation, then select 'Create Account' or click 'Request Proposal' and an account will be created for you automatically." },
    { q: "How can I contact you?", a: "Call us at (408) 872-8340, email luxservicesbayarea@gmail.com, or use the contact form on our website. We respond within 24 hours." },
  ],

  testimonials: [
    { name: "Jonathan Harrington", title: "CEO, Harrington Ventures", location: "Atherton, CA", quote: "All In One handled our corporate relocation with the precision and professionalism we expect at the executive level." },
    { name: "Dr. Sophia Chen", title: "Chief of Surgery, Stanford Medical", location: "Palo Alto, CA", quote: "When we needed our estate's grounds transformed for our daughter's wedding, All In One exceeded every expectation." },
    { name: "Richard & Alexandra Thornton", title: "Partners, Pacific Equity", location: "Hillsborough, CA", quote: "From the initial consultation to the final walkthrough, All In One operated with a level of care and attention I've rarely encountered." },
  ],

  awards: [
    "Best of Bay Area 2024",
    "5-Star Houzz Service Award",
    "Inc. 5000 Fastest Growing",
    "BBB Torch Award for Ethics",
    "Green Business Certified",
    "Top Workplace Bay Area"
  ]
}

// Tools for the AI agent
const tools = {
  // Navigation tool - tells the chatbot to navigate the user
  navigateToPage: tool({
    description: 'Navigate the user to a specific page on the website. Use this when users want to go somewhere, see something, or access a feature.',
    inputSchema: z.object({
      page: z.enum(['home', 'services', 'about', 'contact', 'globalPresence', 'quote', 'clientPortal', 'adminPortal', 'videoStudio']).describe('The page to navigate to'),
      reason: z.string().describe('Brief explanation of why navigating here'),
    }),
    execute: async ({ page, reason }) => {
      const pageInfo = AI1_KNOWLEDGE.pages[page]
      return {
        action: 'navigate',
        path: pageInfo.path,
        description: pageInfo.description,
        reason,
        message: `I'll take you to ${page === 'home' ? 'the homepage' : page.replace(/([A-Z])/g, ' $1').toLowerCase()}. ${reason}`
      }
    },
  }),

  // Open login modal
  openLoginModal: tool({
    description: 'Open the login/sign-in modal for the user. Use this when users want to sign in, create an account, access their portal, or manage their account.',
    inputSchema: z.object({
      intent: z.enum(['login', 'createAccount', 'accessPortal']).describe('What the user wants to do'),
    }),
    execute: async ({ intent }) => {
      return {
        action: 'openLogin',
        intent,
        message: intent === 'createAccount' 
          ? "I'll open the sign-in panel for you. You can create a new account or sign in with an existing one."
          : "I'll open the sign-in panel so you can access your account."
      }
    },
  }),

  // Initiate phone call
  initiateCall: tool({
    description: 'Help the user call AI1. Use this when users want to call, speak to someone, or need immediate phone assistance.',
    inputSchema: z.object({
      reason: z.string().optional().describe('Reason for the call'),
    }),
    execute: async ({ reason }) => {
      return {
        action: 'call',
        phone: AI1_KNOWLEDGE.company.phone,
        phoneRaw: AI1_KNOWLEDGE.company.phoneRaw,
        message: `I can connect you with our team right now. Our number is ${AI1_KNOWLEDGE.company.phone}. Would you like me to initiate the call?`,
        reason
      }
    },
  }),

  // Get service information
  getServiceInfo: tool({
    description: 'Get detailed information about services. Use for questions about what services are offered, service details, or comparisons.',
    inputSchema: z.object({
      category: z.enum(['private', 'corporate', 'all']).default('all').describe('Service category'),
      serviceId: z.string().optional().describe('Specific service ID if asking about one service'),
    }),
    execute: async ({ category, serviceId }) => {
      if (serviceId) {
        const allServices = [...AI1_KNOWLEDGE.services.private, ...AI1_KNOWLEDGE.services.corporate]
        const service = allServices.find(s => s.id === serviceId || s.title.toLowerCase().includes(serviceId.toLowerCase()))
        return service || { error: 'Service not found', availableServices: allServices.map(s => s.title) }
      }
      
      if (category === 'all') {
        return {
          privateServices: AI1_KNOWLEDGE.services.private,
          corporateServices: AI1_KNOWLEDGE.services.corporate,
          totalServices: AI1_KNOWLEDGE.services.private.length + AI1_KNOWLEDGE.services.corporate.length
        }
      }
      
      return AI1_KNOWLEDGE.services[category]
    },
  }),

  // Get company information
  getCompanyInfo: tool({
    description: 'Get company information like contact details, history, stats, certifications, or general info.',
    inputSchema: z.object({
      topic: z.enum(['contact', 'certifications', 'stats', 'history', 'social', 'general']).describe('What information to retrieve'),
    }),
    execute: async ({ topic }) => {
      switch (topic) {
        case 'contact':
          return { phone: AI1_KNOWLEDGE.company.phone, email: AI1_KNOWLEDGE.company.email, location: AI1_KNOWLEDGE.company.location }
        case 'certifications':
          return { certifications: AI1_KNOWLEDGE.company.certifications, coverage: AI1_KNOWLEDGE.company.coverage }
        case 'stats':
          return AI1_KNOWLEDGE.company.stats
        case 'history':
          return { founded: AI1_KNOWLEDGE.company.founded, yearsInBusiness: AI1_KNOWLEDGE.company.yearsInBusiness, description: AI1_KNOWLEDGE.company.description }
        case 'social':
          return AI1_KNOWLEDGE.company.socialMedia
        default:
          return AI1_KNOWLEDGE.company
      }
    },
  }),

  // Get FAQ answer
  getFAQAnswer: tool({
    description: 'Get answers to frequently asked questions about services, pricing, process, accounts, etc.',
    inputSchema: z.object({
      question: z.string().describe('The question to find an answer for'),
    }),
    execute: async ({ question }) => {
      const q = question.toLowerCase()
      const faq = AI1_KNOWLEDGE.faq.find(f => 
        f.q.toLowerCase().includes(q) || q.includes(f.q.toLowerCase().split(' ').slice(0, 3).join(' '))
      )
      return faq || { answer: "I don't have a specific FAQ for that, but I can help! What would you like to know?", allFAQs: AI1_KNOWLEDGE.faq.map(f => f.q) }
    },
  }),

  // Get page/section info
  getPageInfo: tool({
    description: 'Get information about what is on a specific page or section of the website.',
    inputSchema: z.object({
      page: z.string().describe('Page or section name'),
    }),
    execute: async ({ page }) => {
      const p = page.toLowerCase()
      const pageInfo = Object.entries(AI1_KNOWLEDGE.pages).find(([key]) => key.toLowerCase().includes(p) || p.includes(key.toLowerCase()))
      const sectionInfo = Object.entries(AI1_KNOWLEDGE.sections).find(([key]) => key.toLowerCase().includes(p) || p.includes(key.toLowerCase()))
      
      return {
        page: pageInfo ? { name: pageInfo[0], ...pageInfo[1] } : null,
        section: sectionInfo ? { name: sectionInfo[0], description: sectionInfo[1] } : null,
        allPages: Object.keys(AI1_KNOWLEDGE.pages),
        allSections: Object.keys(AI1_KNOWLEDGE.sections)
      }
    },
  }),

  // Get testimonials
  getTestimonials: tool({
    description: 'Get client testimonials and reviews.',
    inputSchema: z.object({}),
    execute: async () => {
      return { testimonials: AI1_KNOWLEDGE.testimonials, source: "These are real testimonials from our clients." }
    },
  }),

  // Get awards
  getAwards: tool({
    description: 'Get company awards and recognition.',
    inputSchema: z.object({}),
    execute: async () => {
      return { awards: AI1_KNOWLEDGE.awards, note: "We've been recognized for excellence in service, ethics, and growth." }
    },
  }),
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: 'openai/gpt-5',
    system: `You are AI1, the intelligent assistant for All In One (AI1) - a premium luxury home services company based in Stanford, CA serving the San Francisco Bay Area since 1996.

Your capabilities:
1. NAVIGATE users to any page (home, services, about, contact, quote, client portal, admin portal, video studio, global presence map)
2. ANSWER questions about services, company, pricing approach, testimonials, awards, FAQ
3. HELP users sign in, create accounts, or access their portal
4. INITIATE phone calls when users want to speak with someone
5. PROVIDE service information for both private (residential) and corporate clients

Personality:
- Professional, warm, knowledgeable, never pushy
- Use the navigation tool proactively when it would help
- When users ask "how do I..." or "where can I...", navigate them there
- For pricing questions, explain we provide bespoke proposals (no fixed pricing displayed)
- Always offer to help further after answering

Key pages:
- /quote - Request a proposal (6-step wizard)
- /client-portal - View service requests (requires login)
- /admin - Staff portal (requires admin login)
- /#services - View all services
- /#contact - Contact form and details
- /#global-presence - Interactive 3D globe of client locations

Contact: (408) 872-8340 | luxservicesbayarea@gmail.com

When a tool returns an "action" field, the UI will handle it. Just confirm what you're doing for the user.`,
    messages: await convertToModelMessages(messages),
    tools,
    maxSteps: 10,
  })

  return result.toUIMessageStreamResponse()
}
