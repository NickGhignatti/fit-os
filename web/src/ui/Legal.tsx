import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from './kit';

/** Who runs the service, for the legal texts below. Change here, and every page follows. */
export const OPERATOR = 'Nick Ghignatti';
export const CONTACT_EMAIL = 'nick.ghignatti@gmail.com';
export const LEGAL_UPDATED = '25 October 2026';
export const MIN_AGE = 16;

const Doc = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className="legal">
    <PageHeader back title={title} subtitle={`Last updated ${LEGAL_UPDATED}`} />
    {children}
    <p className="small muted" style={{ marginTop: 32 }}>
      <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link>
    </p>
  </article>
);

const Contact = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

/** Links to both documents, for footers and sign-in prompts. */
export const LegalLinks = () => (
  <span>
    <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
  </span>
);

export const PrivacyPolicy = () => (
  <Doc title="Privacy Policy">
    <p>
      Tracker is a training, diet and calorie tracker that runs in your browser. This policy explains what
      information it handles, why, who else touches it, and the choices you have. It is written to match what the
      app really does.
    </p>

    <h2>1. Who is responsible</h2>
    <p>
      The app is operated by {OPERATOR}, an individual (“we”, “us”). For anything about your data, write to <Contact />.
    </p>

    <h2>2. The short version</h2>
    <ul>
      <li>Your workouts, diets, food log, weight and profile stay <strong>on your device</strong>. We do not receive them.</li>
      <li>You do not need an account to use the app. An account is only for publishing plans for others.</li>
      <li>There is no advertising, no analytics and no tracking.</li>
      <li>You can delete your account, and everything we hold about it, from inside the app.</li>
    </ul>

    <h2>3. Information that stays on your device</h2>
    <p>
      The app stores the following in your browser (in its local database, IndexedDB): workout plans and logged
      workouts, diet plans, your food log, foods you created or marked as favourites, packaged products you looked up,
      your weigh-ins, and your profile (sex, birth date, height, activity level, goal, and any calorie or macro targets
      you set). If you sign in, the browser also keeps your sign-in session in local storage. The app’s files and its
      exercise and food catalogues are cached by the browser so the app works offline.
    </p>
    <p>
      This information includes health-related details. It is processed only on your device, under your control. We
      cannot see it, and we do not use it. It leaves your device only when <em>you</em> choose to send or publish
      something, as described below. Clearing your browser’s site data deletes it, so use <em>Export backup</em> in your
      profile to keep a copy.
    </p>
    <p>
      A photo you take to log a meal is looked at by the food recogniser on your device, then forgotten: it is not
      stored and not sent anywhere. Only the foods you choose to log are kept.
    </p>

    <h2>4. Information that leaves your device only when you act</h2>
    <h3>Sending an item to another device</h3>
    <p>
      When you press “Send”, the item is encrypted in your browser with a key derived from a one-time code, and only
      the encrypted data and a value derived from the code are uploaded. We cannot read it: the code is never sent to
      us. It is deleted from our server as soon as it is received on the other device, and in any case within 24 hours.
    </p>
    <h3>Signing in with Google</h3>
    <p>
      If you choose “Sign in with Google”, Google tells our authentication provider (Supabase) who you are. We receive
      the basic details Google shares for sign-in: a Google account identifier, your email address, and the name and
      picture on your Google account. They are stored by Supabase in the authentication system, and we use them only to
      let you sign in and keep your account secure. They are <strong>not</strong> shown to other users and are not copied
      to your public profile. We can technically see them in our Supabase dashboard; we do not use them for anything else
      and we do not sell or share them.
    </p>
    <p>
      Our use of information received from Google is limited to providing sign-in and the features described here, and
      adheres to the Google API Services User Data Policy, including its Limited Use requirements.
    </p>
    <h3>Your public profile and published plans</h3>
    <p>
      A new account gets a random handle (for example <code>user_3f9a1c2e</code>). You may change it and add a display
      name. When you publish a plan, its content, title, description, handle, display name and publication date are
      <strong> public</strong>: anyone can read and copy them, with or without an account. Do not put personal or sensitive
      information in a plan you publish. You can unpublish a plan at any time.
    </p>
    <h3>Adding a device</h3>
    <p>
      When you choose “Add a device” while signed in, everything on your device (plans, workouts, food log, weight and
      profile) is encrypted in your browser with a key derived from a one-time code, and only the encrypted data, a value
      derived from the code and your account identifier are uploaded. We cannot read it: the code is never sent to us.
      Only your account can fetch it, on the device where you scan the code. It is deleted from our server as soon as that
      device has it, when you start another one, and in any case within 30 minutes.
    </p>
    <h3>Reports</h3>
    <p>
      If you report a plan, we store your account identifier, the plan and your reason. Reports are visible only to us
      and are used to keep the library safe.
    </p>

    <h2>5. Other services your browser contacts</h2>
    <p>These services receive your IP address and what is needed for the request, as with any website:</p>
    <ul>
      <li><strong>Cloudflare</strong> hosts the app’s files. It processes technical request data such as IP address and browser type to deliver the site and protect it.</li>
      <li><strong>Supabase</strong> provides our database and sign-in. It is contacted when you send or receive an item, sign in, add a device, or browse, publish or report community plans.</li>
      <li><strong>Google</strong> handles the sign-in screen when you choose to sign in, under its own privacy policy.</li>
      <li><strong>Open Food Facts</strong> is queried directly from your browser when you search packaged products or scan a barcode. It receives your search text or the barcode number and your IP address.</li>
      <li><strong>jsDelivr</strong> serves the exercise photos when you open an exercise.</li>
    </ul>
    <p>
      Each of these has its own privacy policy. Some may process data outside the European Economic Area; where that
      happens they rely on safeguards such as adequacy decisions or standard contractual clauses.
    </p>

    <h2>6. Why we may process it, and on what basis</h2>
    <ul>
      <li>To provide the app and your account (performance of a contract).</li>
      <li>To sign you in with Google and to publish what you choose to publish (your consent, which you can withdraw by signing out or deleting your account).</li>
      <li>To keep the service secure, prevent abuse and handle reports (our legitimate interest).</li>
      <li>To comply with the law when required.</li>
    </ul>

    <h2>7. How long we keep it</h2>
    <ul>
      <li>Items in transit: until received, and at most 24 hours. Data for a new device: until it is fetched, and at most 30 minutes.</li>
      <li>Account, profile, published plans and reports you made: until you delete your account. Deletion is immediate and removes the account, the public profile, your published plans and your reports. Copies in the provider’s own backups, if any, expire on their normal schedule.</li>
      <li>Reports about a plan are deleted together with that plan.</li>
      <li>Technical logs kept by our hosting providers: according to their policies.</li>
      <li>Everything on your device: until you delete it or clear your browser’s data.</li>
    </ul>

    <h2>8. Cookies and similar technologies</h2>
    <p>
      We do not use advertising, analytics or tracking cookies. The app uses your browser’s storage only for things it
      cannot work without: your data on your device, your sign-in session, and cached app files. Because these are
      strictly necessary, no cookie banner is needed.
    </p>

    <h2>9. Your rights</h2>
    <p>
      You can ask for access to, correction of, deletion of, or a portable copy of your personal data, and you can
      object to or restrict its processing. Most of this you can do yourself: your data is on your device, “Export
      backup” gives you a copy, and “Delete account” erases your account. For anything else write to <Contact />. If you
      are unhappy with our answer you can complain to your data protection authority (in Italy, the Garante per la
      protezione dei dati personali, garanteprivacy.it).
    </p>

    <h2>10. Children</h2>
    <p>
      Tracker is not for people under {MIN_AGE}. We do not knowingly collect information from them. If you believe a
      child has created an account, write to <Contact /> and we will delete it.
    </p>

    <h2>11. Security</h2>
    <p>
      Items you send, and data for a new device, are end-to-end encrypted. Connections use HTTPS. Access to community data is limited by database
      rules so that people can read public plans but only change their own. No system is perfectly secure; keep your
      Google account protected and your backups private.
    </p>

    <h2>12. Changes</h2>
    <p>
      If we change this policy in a meaningful way we will update the date above and, where it matters, tell you in the
      app. Please check it from time to time.
    </p>
  </Doc>
);

export const TermsOfService = () => (
  <Doc title="Terms of Service">
    <p>
      These terms govern your use of Tracker. By using the app, or by creating an account, you agree to them and to the
      <Link to="/privacy"> Privacy Policy</Link>. If you do not agree, please do not use the app.
    </p>

    <h2>1. The service</h2>
    <p>
      Tracker lets you plan workouts and diets, log training, food and weight, and, if you want, publish plans to a
      public library and copy plans published by others. It is operated by {OPERATOR} (<Contact />). The app is provided
      free of charge and may change or stop at any time.
    </p>

    <h2>2. Who may use it</h2>
    <p>
      You must be at least {MIN_AGE} years old. You are responsible for what you do with the app and with your Google
      account, and for keeping your device and account secure.
    </p>

    <h2>3. Not medical advice</h2>
    <p>
      <strong>Tracker is not medical, dietetic or fitness-professional advice.</strong> Calorie and macro targets are
      general estimates calculated from the details you enter. Plans, whether yours or published by others, are not
      reviewed by professionals and may not suit you. Exercise carries risk of injury. Before starting or changing a
      training or eating plan, especially if you have a medical condition, are pregnant, are recovering from injury, or
      have or may have an eating disorder, speak to a qualified professional. Stop and seek help if you feel unwell. You
      use the app and any plan at your own risk.
    </p>

    <h2>4. Your data</h2>
    <p>
      The information you enter is stored on your device. You are responsible for keeping backups; use the export
      function. We are not liable for data lost because browser storage is cleared or a device is lost.
    </p>

    <h2>5. Content you publish</h2>
    <ul>
      <li>You keep the rights you have in what you publish.</li>
      <li>By publishing, you give us and other users a free, worldwide, non-exclusive licence to host, display and copy it within the app, so the library can work. You can unpublish at any time; copies other people already made for their own use stay with them.</li>
      <li>You promise that you have the right to publish it and that it does not break the law or anyone’s rights.</li>
    </ul>

    <h2>6. What you must not do</h2>
    <ul>
      <li>Publish anything unlawful, hateful, harassing, deceptive, or that infringes someone’s rights.</li>
      <li>Publish content that promotes eating disorders, self-harm, dangerous crash diets or unsafe training, or that makes false health claims.</li>
      <li>Include personal information about yourself or others in a plan, or impersonate someone else.</li>
      <li>Spam, flood the library, or try to disrupt, probe or overload the service, or access data that is not yours.</li>
      <li>Use the app to collect other users’ data, or in violation of any law.</li>
    </ul>

    <h2>7. Reports and moderation</h2>
    <p>
      Anyone signed in can report a plan. A plan reported by several people is hidden until we review it. We may remove
      content, limit features or suspend or delete accounts that break these terms or the law, with or without notice
      where reasonable. To report illegal content or ask us to review a decision, write to <Contact /> with the plan,
      what the problem is and how to reach you.
    </p>

    <h2>8. Third-party data</h2>
    <p>
      Food data comes from the CREA food composition tables (Italy) and from Open Food Facts, made available under the
      Open Database Licence; exercise descriptions and photos come from free-exercise-db (public domain). Such data may
      be incomplete or wrong; check labels and instructions yourself.
    </p>
    <p>
      The photo food recogniser runs on your device and is built on DINOv2 (Meta, Apache License 2.0), run by ONNX
      Runtime (Microsoft, MIT Licence). It learned from the MyFoodRepo Food Recognition Benchmark (AIcrowd and EPFL,
      CC BY 4.0), Nutrition5k (Google, CC BY 4.0), Open Images V7 (Google; labels CC BY 4.0, photos CC BY 2.0) and
      COCO 2017 (annotations CC BY 4.0, only photos under open licences). Its guesses, and the weights it suggests, can
      be wrong: check them before logging.
    </p>

    <h2>9. No warranty</h2>
    <p>
      The app is provided “as is” and “as available”, without promises that it will be uninterrupted, error-free or
      suitable for your purpose, to the extent the law allows.
    </p>

    <h2>10. Limit of liability</h2>
    <p>
      To the extent the law allows, we are not liable for indirect or consequential loss, for loss of data, or for harm
      resulting from following a plan or target. Nothing in these terms limits liability that cannot be limited by law,
      such as for death or personal injury caused by negligence, for fraud, or your rights as a consumer under the law
      where you live.
    </p>

    <h2>11. Ending your use</h2>
    <p>
      You can stop using the app at any time and delete your account in your profile. We may suspend or end the service
      or your access as described above. Sections that by their nature should continue (such as 3, 5, 9 and 10) do.
    </p>

    <h2>12. Changes and governing law</h2>
    <p>
      We may update these terms; the date above shows the latest version, and continued use after a change means you
      accept it. These terms are governed by the law of the country where the operator is established, without removing
      the mandatory consumer protections of the country where you live.
    </p>

    <h2>13. Contact</h2>
    <p>Questions about these terms: <Contact />.</p>
  </Doc>
);
