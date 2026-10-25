import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from './kit';

/** Who runs the service, for the legal texts below. Change here, and every page follows. */
export const OPERATOR = 'Nick Ghignatti';
export const CONTACT_EMAIL = 'nick.ghignatti@gmail.com';
export const LEGAL_UPDATED = '24 October 2026';
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

/** Links to both documents, for footers. */
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
      <li>There are no accounts: you never sign in, and we hold no profile about you.</li>
      <li>There is no advertising, no analytics and no tracking.</li>
    </ul>

    <h2>3. Information that stays on your device</h2>
    <p>
      The app stores the following in your browser (in its local database, IndexedDB): workout plans and logged
      workouts, diet plans, your food log, foods you created or marked as favourites, packaged products you looked up,
      your weigh-ins, and your profile (sex, birth date, height, activity level, goal, and any calorie or macro targets
      you set). The app’s files and its
      exercise and food catalogues are cached by the browser so the app works offline.
    </p>
    <p>
      This information includes health-related details. It is processed only on your device, under your control. We
      cannot see it, and we do not use it. It leaves your device only when <em>you</em> choose to send something
      to another device, as described below. Clearing your browser’s site data deletes it, so use <em>Export backup</em> in your
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

    <h2>5. Other services your browser contacts</h2>
    <p>These services receive your IP address and what is needed for the request, as with any website:</p>
    <ul>
      <li><strong>Cloudflare</strong> hosts the app’s files. It processes technical request data such as IP address and browser type to deliver the site and protect it.</li>
      <li><strong>Supabase</strong> provides the server that passes items between your devices. It is contacted only when you send or receive an item.</li>
      <li><strong>Open Food Facts</strong> is queried directly from your browser when you search packaged products or scan a barcode. It receives your search text or the barcode number and your IP address.</li>
      <li><strong>jsDelivr</strong> serves the exercise photos when you open an exercise.</li>
    </ul>
    <p>
      Each of these has its own privacy policy. Some may process data outside the European Economic Area; where that
      happens they rely on safeguards such as adequacy decisions or standard contractual clauses.
    </p>

    <h2>6. Why we may process it, and on what basis</h2>
    <ul>
      <li>To pass an item you send to your other device (performance of a contract).</li>
      <li>To keep the service secure and prevent abuse (our legitimate interest).</li>
      <li>To comply with the law when required.</li>
    </ul>

    <h2>7. How long we keep it</h2>
    <ul>
      <li>Items in transit: until received, and at most 24 hours.</li>
      <li>Technical logs kept by our hosting providers: according to their policies.</li>
      <li>Everything on your device: until you delete it or clear your browser’s data.</li>
    </ul>

    <h2>8. Cookies and similar technologies</h2>
    <p>
      We do not use advertising, analytics or tracking cookies. The app uses your browser’s storage only for things it
      cannot work without: your data on your device and cached app files. Because these are
      strictly necessary, no cookie banner is needed.
    </p>

    <h2>9. Your rights</h2>
    <p>
      You can ask for access to, correction of, deletion of, or a portable copy of your personal data, and you can
      object to or restrict its processing. Most of this you can do yourself: your data is on your device, and “Export
      backup” gives you a copy. For anything else write to <Contact />. If you
      are unhappy with our answer you can complain to your data protection authority (in Italy, the Garante per la
      protezione dei dati personali, garanteprivacy.it).
    </p>

    <h2>10. Children</h2>
    <p>
      Tracker is not for people under {MIN_AGE}. We do not knowingly collect information from them.
    </p>

    <h2>11. Security</h2>
    <p>
      Items you send are end-to-end encrypted. Connections use HTTPS. No system is perfectly secure; keep your device
      and your backups private.
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
      These terms govern your use of Tracker. By using the app you agree to them and to the
      <Link to="/privacy"> Privacy Policy</Link>. If you do not agree, please do not use the app.
    </p>

    <h2>1. The service</h2>
    <p>
      Tracker lets you plan workouts and diets, log training, food and weight, and move plans between your own devices. It is operated by {OPERATOR} (<Contact />). The app is provided
      free of charge and may change or stop at any time.
    </p>

    <h2>2. Who may use it</h2>
    <p>
      You must be at least {MIN_AGE} years old. You are responsible for what you do with the app and for keeping your
      device secure.
    </p>

    <h2>3. Not medical advice</h2>
    <p>
      <strong>Tracker is not medical, dietetic or fitness-professional advice.</strong> Calorie and macro targets are
      general estimates calculated from the details you enter. Plans are not reviewed by professionals and may not suit you. Exercise carries risk of injury. Before starting or changing a
      training or eating plan, especially if you have a medical condition, are pregnant, are recovering from injury, or
      have or may have an eating disorder, speak to a qualified professional. Stop and seek help if you feel unwell. You
      use the app and any plan at your own risk.
    </p>

    <h2>4. Your data</h2>
    <p>
      The information you enter is stored on your device. You are responsible for keeping backups; use the export
      function. We are not liable for data lost because browser storage is cleared or a device is lost.
    </p>

    <h2>5. Third-party data</h2>
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

    <h2>6. No warranty</h2>
    <p>
      The app is provided “as is” and “as available”, without promises that it will be uninterrupted, error-free or
      suitable for your purpose, to the extent the law allows.
    </p>

    <h2>7. Limit of liability</h2>
    <p>
      To the extent the law allows, we are not liable for indirect or consequential loss, for loss of data, or for harm
      resulting from following a plan or target. Nothing in these terms limits liability that cannot be limited by law,
      such as for death or personal injury caused by negligence, for fraud, or your rights as a consumer under the law
      where you live.
    </p>

    <h2>8. Ending your use</h2>
    <p>
      You can stop using the app at any time. We may suspend or end the service. Sections that by their nature should
      continue (such as 3, 6 and 7) do.
    </p>

    <h2>9. Changes and governing law</h2>
    <p>
      We may update these terms; the date above shows the latest version, and continued use after a change means you
      accept it. These terms are governed by the law of the country where the operator is established, without removing
      the mandatory consumer protections of the country where you live.
    </p>

    <h2>10. Contact</h2>
    <p>Questions about these terms: <Contact />.</p>
  </Doc>
);
