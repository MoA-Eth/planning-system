import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Shield,
  Lock,
  Eye,
  Database,
  UserCheck,
  AlertTriangle,
  Mail,
  Phone,
  ChevronLeft,
} from 'lucide-react';

interface PolicySection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const sections: PolicySection[] = [
    {
      id: 'introduction',
      icon: <Shield className="w-5 h-5" />,
      title: '1. Introduction',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            The Ministry of Agriculture of the Federal Democratic Republic of Ethiopia ("the Ministry",
            "we", "our", or "us") operates the AgriPerformance Planning & Performance Management System
            (the "System"). This Privacy Policy explains how we collect, use, store, and protect
            information obtained through the System.
          </p>
          <p>
            This System is an internal, secure platform intended exclusively for authorised Ministry of
            Agriculture personnel and designated stakeholders. By accessing or using the System, you
            acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
          </p>
          <p>
            This policy was last updated on <strong>April 24, 2026</strong> and is effective from that date.
          </p>
        </div>
      ),
    },
    {
      id: 'information-collected',
      icon: <Database className="w-5 h-5" />,
      title: '2. Information We Collect',
      content: (
        <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
          <p>We collect the following categories of information when you use the System:</p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2">Account & Identity Information</h4>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>Full name and official job title</li>
                <li>Ministry-issued email address</li>
                <li>Assigned username and encrypted password</li>
                <li>Assigned role and department/sector affiliation</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2">Operational Data</h4>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>Annual plans, quarterly targets, and performance entries you submit</li>
                <li>Reviews, validations, and approval decisions you record</li>
                <li>Advisor comments and supporting documents you upload</li>
                <li>Edits, overrides, and corrections made to existing records</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2">Activity & Audit Data</h4>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>Login timestamps, session durations, and IP addresses</li>
                <li>Actions performed within the System (creates, edits, deletions)</li>
                <li>System-generated activity logs for audit and compliance purposes</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-2">Technical Data</h4>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>Browser type, operating system, and device identifiers</li>
                <li>HTTP request logs for security and debugging purposes</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'how-we-use',
      icon: <Eye className="w-5 h-5" />,
      title: '3. How We Use Your Information',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>Information collected through the System is used solely for the following purposes:</p>
          <ul className="space-y-2">
            {[
              'To authenticate your identity and grant role-appropriate access to the System.',
              'To enable the creation, review, validation, and approval of agricultural plans and performance records.',
              'To generate reports and dashboards for strategic decision-making at all levels of the Ministry.',
              'To maintain complete and auditable activity logs for accountability and compliance.',
              'To detect, investigate, and prevent unauthorised access, fraud, or security incidents.',
              'To provide technical support and resolve issues reported by users.',
              'To improve the functionality and performance of the System.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
            <strong>Important:</strong> Your information will <strong>never</strong> be sold, rented, or
            shared with third parties for commercial purposes.
          </p>
        </div>
      ),
    },
    {
      id: 'data-access',
      icon: <UserCheck className="w-5 h-5" />,
      title: '4. Access to Your Information',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>Access to data within the System is strictly role-based and governed by the principle of least privilege:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {[
              { role: 'Department Staff', access: 'Can view and submit data for their own department only.' },
              { role: 'Strategic Staff', access: 'Can view cross-department data and perform validation tasks.' },
              { role: 'State Minister', access: 'Can review and provide guidance on plans and performance.' },
              { role: 'Minister', access: 'Read-only access to executive-level dashboards and summaries.' },
              { role: 'Lead Executive Body', access: 'Access to sector-level analytics and reports.' },
              { role: 'System Administrator', access: 'Full access to all data for administration and audit purposes only.' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="font-semibold text-emerald-700 mb-1">{item.role}</div>
                <div className="text-xs text-gray-600">{item.access}</div>
              </div>
            ))}
          </div>
          <p className="mt-3">
            All access attempts and data operations are logged in the System's audit trail. Superadmin
            overrides are separately recorded with full before/after values for transparency.
          </p>
        </div>
      ),
    },
    {
      id: 'data-security',
      icon: <Lock className="w-5 h-5" />,
      title: '5. Data Security',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            The Ministry employs robust technical and organisational safeguards to protect your information
            against unauthorised access, loss, or disclosure:
          </p>
          <ul className="space-y-2">
            {[
              'All data is transmitted over encrypted HTTPS connections (TLS).',
              'User passwords are hashed using industry-standard algorithms and are never stored in plaintext.',
              'Authentication tokens are time-limited and invalidated upon logout.',
              'The System is hosted on secure servers with restricted physical and network access.',
              'Regular security reviews and vulnerability assessments are conducted.',
              'Activity logs are immutable and protected against tampering.',
              'Access credentials are unique per user; shared accounts are prohibited.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="font-semibold text-emerald-800 mb-2">Your Responsibilities</p>
            <ul className="space-y-1 text-emerald-700 text-xs">
              <li>- Never share your password or authentication credentials with anyone.</li>
              <li>- Always log out of the System after completing your session.</li>
              <li>- Report any suspected security breach immediately to the System Administrator.</li>
              <li>- Use the System only from approved, secure Ministry devices where possible.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'data-retention',
      icon: <Database className="w-5 h-5" />,
      title: '6. Data Retention',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            Data within the System is retained for the periods necessary to fulfil the purposes described
            in this policy and to comply with applicable laws and regulations:
          </p>
          <div className="space-y-2 mt-3">
            {[
              { type: 'Planning & Performance Records', period: 'Retained indefinitely for historical reporting and trend analysis.' },
              { type: 'Activity & Audit Logs', period: 'Retained for a minimum of 7 years for compliance and accountability purposes.' },
              { type: 'User Account Data', period: 'Retained while your account is active; archived for 2 years following deactivation.' },
              { type: 'Uploaded Documents', period: "Retained in accordance with the Ministry's official document management policy." },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-1 bg-emerald-400 rounded-full flex-shrink-0"></div>
                <div>
                  <div className="font-semibold text-gray-800 text-xs">{item.type}</div>
                  <div className="text-gray-600 text-xs mt-0.5">{item.period}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'your-rights',
      icon: <UserCheck className="w-5 h-5" />,
      title: '7. Your Rights',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>As an authorised user of the System, you have the following rights:</p>
          <ul className="space-y-2">
            {[
              { right: 'Right of Access', desc: 'You may request a summary of the personal data the System holds about you.' },
              { right: 'Right to Correction', desc: 'You may request corrections to inaccurate personal data through your System Administrator.' },
              { right: 'Right to Know', desc: 'You may request information about how your data is being used.' },
              { right: 'Right to Report', desc: "You may report concerns about data handling to the Ministry's designated Data Protection Officer." },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                <span><strong className="text-gray-700">{item.right}:</strong> {item.desc}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Note: Certain categories of data (e.g., audit logs) cannot be deleted or modified in order to
            preserve the integrity of the System's accountability mechanisms.
          </p>
        </div>
      ),
    },
    {
      id: 'policy-changes',
      icon: <AlertTriangle className="w-5 h-5" />,
      title: '8. Changes to This Policy',
      content: (
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            The Ministry reserves the right to update this Privacy Policy at any time to reflect changes
            in legal requirements, Ministry directives, or System functionality. When material changes
            are made, an updated version will be published within the System and users will be notified.
          </p>
          <p>
            Continued use of the System after notification of changes constitutes acceptance of the
            updated Privacy Policy. It is your responsibility to review this policy periodically.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 w-10 h-10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">
                AgriPerformance
              </h1>
              <p className="text-xs text-gray-500">Ministry of Agriculture</p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-green-800 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-5">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Privacy Policy</h2>
          <p className="text-emerald-100/90 max-w-xl mx-auto text-sm">
            How the Ministry of Agriculture collects, uses, and protects information
            within the AgriPerformance Planning & Performance Management System.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-emerald-100 text-xs font-medium">
            <span>Effective Date: April 24, 2026</span>
            <span className="w-1 h-1 rounded-full bg-emerald-300"></span>
            <span>Version 1.0</span>
          </div>
        </div>
      </div>

      {/* Table of Contents + Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sticky Table of Contents */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Contents</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all duration-150 group"
                  >
                    <span className="text-gray-400 group-hover:text-emerald-500 flex-shrink-0">
                      {section.icon}
                    </span>
                    <span>{section.title}</span>
                  </a>
                ))}
              </nav>

              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">Questions about this policy?</p>
                <a
                  href="mailto:planning.performance@moa.gov"
                  className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Contact us
                </a>
              </div>
            </div>
          </aside>

          {/* Policy Sections */}
          <main className="lg:col-span-3 space-y-6">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-28"
              >
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-emerald-50 to-white">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    {section.icon}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                </div>
                <div className="px-6 py-5">{section.content}</div>
              </section>
            ))}

            {/* Contact Card */}
            <section className="bg-gradient-to-r from-emerald-700 to-green-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 md:p-8">
                <h3 className="text-xl font-bold text-white mb-2">Contact the Data Protection Officer</h3>
                <p className="text-emerald-100/80 text-sm mb-6">
                  For any privacy-related queries, requests, or concerns regarding this System, please
                  reach out to the Ministry's designated data protection contact.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                    <Mail className="w-5 h-5 text-emerald-200 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-emerald-300 mb-0.5">Email</div>
                      <div className="text-white text-sm font-medium">developer@moa.gov.et</div>
                    </div>
                  </div>
                  {/* <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                    <Phone className="w-5 h-5 text-emerald-200 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-emerald-300 mb-0.5">Phone</div>
                      <div className="text-white text-sm font-medium">+251-000-000-000</div>
                    </div>
                  </div> */}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">AgriPerformance</div>
                <div className="text-xs">Ministry of Agriculture</div>
              </div>
            </div>
            <div className="text-xs text-center">
              &copy; {new Date().getFullYear()} Planning & Performance Platform. All rights reserved.
            </div>
            <button
              onClick={() => navigate(-1)}
              className="text-sm hover:text-white transition-colors"
            >
              &larr; Back to Home
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
