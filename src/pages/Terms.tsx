import Navigation from "@/components/Navigation";
import Footer from "./Footer";

const Terms = () => {
    return (
        <div className="relative overflow-x-hidden">
            <div className="container mx-auto px-4 py-24 text-white">
                <div className="max-w-3xl mx-auto space-y-12">

                    {/* Terms & Conditions */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-bold mb-4">Orbiit Terms & Conditions (Switzerland)</h1>
                            <p className="text-lg text-gray-300">Last Updated: February 18, 2026</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-300">
                                These Terms & Conditions (“Terms”) govern your access to and use of the Orbiit platform, website, and related services (“Services”) operated by Orbiit (“Orbiit”, “we”, “us”).
                            </p>
                            <p className="text-gray-300">
                                By creating an account, registering for an event, or using the Services, you agree to these Terms.
                            </p>
                        </div>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">1. Eligibility</h2>
                            <p className="text-gray-300">Orbiit is intended for students enrolled at participating universities.</p>
                            <p className="text-gray-300">By using the Services you confirm that:</p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-300">
                                <li>You are at least 18 years old</li>
                                <li>You are currently enrolled at a participating university</li>
                                <li>All information you provide is accurate and truthful</li>
                                <li>You use the Services for genuine social or dating purposes</li>
                            </ul>
                            <p className="text-gray-300">We may request verification and suspend accounts that do not meet these conditions.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">2. Nature of the Service</h2>
                            <p className="text-gray-300">Orbiit is a social introduction platform that suggests potential matches and enables voluntary in-person meetings between users.</p>
                            <p className="text-gray-300">Orbiit does not conduct background checks, supervise meetings, verify identity beyond provided information, guarantee compatibility or attraction, or guarantee safety or behavior of users.</p>
                            <p className="text-gray-300">All interactions occur independently between users.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">3. Assumption of Risk</h2>
                            <p className="text-gray-300">You understand that meeting new people involves inherent personal and social risks.</p>
                            <p className="text-gray-300">You voluntarily accept responsibility for your decisions and conduct before, during, and after interacting with another user, including attending dates or events.</p>
                            <p className="text-gray-300">Orbiit is not a chaperone, agent, or organizer of interpersonal conduct.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">4. User Conduct</h2>
                            <p className="text-gray-300">You agree to act respectfully and lawfully.</p>
                            <p className="text-gray-300">You must not harass, threaten, stalk, or intimidate others, misrepresent identity or intentions, share another user’s personal information without consent, use the Services for commercial solicitation, or engage in unlawful or discriminatory behavior.</p>
                            <p className="text-gray-300">We may suspend or permanently remove users who create safety concerns.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">5. Matching and No Reliance</h2>
                            <p className="text-gray-300">Matches are generated using self-reported information and internal matching methods.</p>
                            <p className="text-gray-300">Orbiit does not verify personality traits, intentions, honesty, or compatibility.</p>
                            <p className="text-gray-300">You agree not to rely on Orbiit as a guarantee of safety, character assessment, or relationship suitability.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">6. Meetings and Events</h2>
                            <p className="text-gray-300">Users independently decide whether to attend dates or events.</p>
                            <p className="text-gray-300">Orbiit does not supervise interactions and is not responsible for participant conduct, belongings, or personal outcomes.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">7. Photos and Videos</h2>
                            <p className="text-gray-300">Orbiit events may be photographed or recorded for community and promotional purposes.</p>
                            <p className="text-gray-300">By attending an event or participating in Orbiit activities, you consent to the use of event photos or videos in Orbiit social media, website, and promotional materials.</p>
                            <p className="text-gray-300">You may request removal of identifiable content at any time by contacting us. Future use will stop where reasonably possible.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">8. Account Moderation</h2>
                            <p className="text-gray-300">We may suspend or terminate accounts if a user violates these Terms, creates discomfort or safety concerns, receives credible complaints, or harms the community environment.</p>
                            <p className="text-gray-300">Moderation decisions may be made to protect users and the platform.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">9. Liability</h2>
                            <p className="text-gray-300">To the extent permitted by Swiss law, Orbiit excludes liability for damages arising from interactions between users, including emotional distress, disagreements, or unmet expectations.</p>
                            <p className="text-gray-300">Nothing excludes liability for unlawful intent or gross negligence under Article 100 of the Swiss Code of Obligations.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">10. Indemnification</h2>
                            <p className="text-gray-300">You agree to indemnify and hold Orbiit harmless from claims, damages, or losses arising from your conduct toward other users, violation of these Terms, or unlawful behavior during interactions.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">11. Data Protection</h2>
                            <p className="text-gray-300">Personal data is processed in accordance with the Swiss Federal Act on Data Protection (revFADP). Further details are provided in the Privacy Policy.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">12. Dispute Resolution</h2>
                            <p className="text-gray-300">Before initiating legal proceedings, users agree to contact Orbiit to attempt informal resolution.</p>
                            <p className="text-gray-300">Contact: <a href="mailto:contact@yourorbiit.com" className="text-primary hover:underline">contact@yourorbiit.com</a></p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">13. Governing Law and Jurisdiction</h2>
                            <p className="text-gray-300">These Terms are governed by Swiss law. Jurisdiction is the registered place of business of Orbiit unless mandatory law provides otherwise.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">14. Changes to Terms</h2>
                            <p className="text-gray-300">We may update these Terms at any time. Continued use of the Services constitutes acceptance of updates.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">15. Contact</h2>
                            <p className="text-gray-300">Orbiit</p>
                            <p className="text-gray-300"><a href="mailto:contact@yourorbiit.com" className="text-primary hover:underline">contact@yourorbiit.com</a></p>
                        </section>
                    </div>

                    <div className="w-full h-px bg-gray-700 my-12" />

                    {/* Privacy Policy */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-bold mb-4">Orbiit Privacy Policy (Switzerland)</h1>
                            <p className="text-lg text-gray-300">Last Updated: February 18, 2026</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-300">This Privacy Policy explains how Orbiit (“Orbiit”, “we”, “us”) collects and processes personal data when you use our platform, website, or events (“Services”).</p>
                            <p className="text-gray-300">We process personal data in accordance with the Swiss Federal Act on Data Protection (revFADP).</p>
                        </div>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">1. What Data We Collect</h2>

                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-white">Account Information</h3>
                                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                                    <li>Name or nickname</li>
                                    <li>Age</li>
                                    <li>University affiliation</li>
                                    <li>Gender and preferences</li>
                                    <li>Contact details such as email or phone number</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-white">Profile and Matching Information</h3>
                                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                                    <li>Questionnaire answers</li>
                                    <li>Dating and social preferences</li>
                                    <li>Communication choices</li>
                                    <li>Availability and event participation</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-white">Technical Data</h3>
                                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                                    <li>Device and browser information</li>
                                    <li>IP address</li>
                                    <li>Log data required for security</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-white">Event Participation</h3>
                                <ul className="list-disc pl-6 space-y-1 text-gray-300">
                                    <li>Attendance records</li>
                                    <li>Feedback responses</li>
                                    <li>Photos or videos taken at events if applicable</li>
                                </ul>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">2. Purpose of Processing</h2>
                            <p className="text-gray-300">We process personal data only for purposes necessary to operate Orbiit:</p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-300">
                                <li>Creating and managing accounts</li>
                                <li>Generating matches and suggestions</li>
                                <li>Organizing dates and events</li>
                                <li>Improving matching accuracy</li>
                                <li>Maintaining platform safety</li>
                                <li>Preventing misuse</li>
                                <li>Communicating service updates</li>
                            </ul>
                            <p className="text-gray-300">We do not sell personal data.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">3. Matching Logic</h2>
                            <p className="text-gray-300">Orbiit uses user-provided answers to generate compatibility suggestions.</p>
                            <p className="text-gray-300">The system identifies patterns in responses and does not produce legal or psychological evaluations.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">4. Sharing of Data</h2>
                            <p className="text-gray-300">We do not share personal data with other users beyond displayed match information.</p>
                            <p className="text-gray-300">We may share limited data with service providers such as hosting or analytics providers only as necessary to operate the Services.</p>
                            <p className="text-gray-300">We do not sell or commercially trade user data.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">5. Storage and Retention</h2>
                            <p className="text-gray-300">Active accounts are stored while the account exists.</p>
                            <p className="text-gray-300">Deleted accounts are removed or anonymized within a reasonable period.</p>
                            <p className="text-gray-300">Safety-related records may be retained longer where necessary to prevent harm or abuse.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">6. User Rights</h2>
                            <p className="text-gray-300">You may request access, correction, or deletion of your data and may withdraw consent to optional processing such as photos.</p>
                            <p className="text-gray-300">Requests: <a href="mailto:contact@yourorbiit.com" className="text-primary hover:underline">contact@yourorbiit.com</a></p>
                            <p className="text-gray-300">We may retain limited information where legally required or necessary for safety.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">7. Security</h2>
                            <p className="text-gray-300">We take reasonable technical and organizational measures to protect personal data from unauthorized access, loss, or misuse.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">8. International Access</h2>
                            <p className="text-gray-300">Service providers may process data outside Switzerland. Appropriate safeguards are applied where required.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">9. Changes</h2>
                            <p className="text-gray-300">We may update this Privacy Policy. Continued use of the Services constitutes acceptance of updates.</p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">10. Contact</h2>
                            <p className="text-gray-300">Orbiit</p>
                            <p className="text-gray-300"><a href="mailto:contact@yourorbiit.com" className="text-primary hover:underline">contact@yourorbiit.com</a></p>
                        </section>
                    </div>

                    <div className="w-full h-px bg-gray-700 my-12" />

                    {/* Cookies Notice */}
                    <div className="space-y-8">
                        <h1 className="text-4xl font-bold mb-8">Cookies Notice</h1>

                        <p className="text-lg text-gray-300">
                            Orbiit uses small data files (“cookies”) to operate the platform.
                        </p>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">What are cookies</h2>
                            <p className="text-gray-300">
                                Cookies are small text files stored on your device that help the website function properly and securely.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">Essential cookies</h2>
                            <p className="text-gray-300">We use necessary cookies to:</p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-300">
                                <li>keep you logged in</li>
                                <li>maintain session security</li>
                                <li>remember basic preferences</li>
                                <li>ensure the platform works correctly</li>
                            </ul>
                            <p className="text-gray-300">
                                These cookies are required for the service to function and cannot be disabled.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">Analytics</h2>
                            <p className="text-gray-300">
                                We may use limited analytics to understand general usage of the platform. This data is processed in aggregated form and is not used to identify individual users.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">No advertising tracking</h2>
                            <p className="text-gray-300">
                                Orbiit does not use advertising or cross-site tracking cookies.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">Managing cookies</h2>
                            <p className="text-gray-300">
                                Most browsers allow you to block or delete cookies in settings. Blocking essential cookies may prevent the platform from functioning properly.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold">Contact</h2>
                            <p className="text-gray-300">
                                <a href="mailto:contact@yourorbiit.com" className="text-primary hover:underline">contact@yourorbiit.com</a>.
                            </p>
                        </section>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default Terms;
