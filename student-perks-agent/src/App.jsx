import { useMemo, useState } from 'react';

const initialProfile = { country: '', university: '', fieldOfStudy: '', interests: '' };
const stages = ['Searching the web', 'Investigating provider pages', 'Checking eligibility', 'Ranking relevant offers'];

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

export default function App() {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState([]);

  function updateField(event) {
    setProfile({ ...profile, [event.target.name]: event.target.value });
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setOffers([]);
    try {
      const response = await fetch('/api/offers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`API returned a non-JSON response (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(result.details || result.error || 'Live research failed.');
      setOffers((result.offers || []).map((offer) => ({ ...offer, officialUrl: offer.url })));
      setMessage(result.offers?.length ? 'Live discovery complete.' : 'The agent did not find any matching student perks in this search.');
    } catch (requestError) {
      setError(requestError.message || 'Live browser research failed.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => ({
    total: offers.length,
    likely: offers.filter((offer) => offer.status === 'likely_eligible').length,
    verify: offers.filter((offer) => offer.status === 'needs_verification').length,
  }), [offers]);

  return (
    <main className="app-shell">
      <nav className="topbar"><span className="brand-mark">✦</span><span>Student Perks Agent</span><span className="live-dot">Live web research</span></nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Your student advantage</p>
          <h1>Your student status is worth <em>more</em> than you think.</h1>
          <p className="intro">Tell us who you are and what you care about. Our browser agent researches live websites, investigates provider pages, and brings back benefits you can actually verify.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span>student</span><span>AI</span><span>cloud</span><span>creative</span></div>
      </section>

      <section className="workspace">
        <div className="profile-panel panel">
          <div className="section-kicker"><span>01</span><span>Your profile</span></div>
          <h2>Make it personal.</h2>
          <p className="panel-intro">The more context you share, the more relevant the live research becomes.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>Country<input name="country" value={profile.country} onChange={updateField} placeholder="India" required /></label>
              <label>University<input name="university" value={profile.university} onChange={updateField} placeholder="VIT Bhopal University" required /></label>
              <label>Field of study<input name="fieldOfStudy" value={profile.fieldOfStudy} onChange={updateField} placeholder="Computer Science" required /></label>
              <label>Interests<input name="interests" value={profile.interests} onChange={updateField} placeholder="AI, cloud, software development" required /></label>
            </div>
            <button className="primary-cta" type="submit" disabled={loading}><span>{loading ? 'Agent is researching' : 'Discover My Perks'}</span><span className="arrow">↗</span></button>
          </form>
          <p className="human-note"><span>⊙</span> Human verification stays in your hands. No accounts, payments, or submissions.</p>
        </div>

        <div className="research-column">
          {loading && <section className="agent-panel panel" aria-live="polite"><div className="agent-heading"><span className="agent-icon">✦</span><div><p className="section-kicker"><span>02</span><span>Live research</span></p><h2>Agent working<span className="blink">…</span></h2></div><span className="working-badge">IN PROGRESS</span></div><div className="stage-list">{stages.map((stage, index) => <div className={`stage ${index === 0 ? 'active' : 'queued'}`} key={stage}><span className="stage-icon">{index === 0 ? '◌' : '○'}</span><span>{stage}</span><span className="stage-state">{index === 0 ? 'active' : 'queued'}</span></div>)}</div><p className="agent-footnote">The backend will return only live, sourced findings. No results are shown while research is in progress.</p></section>}

          {!loading && (message || error || offers.length > 0) && <section className="results-area" aria-live="polite">
            <p className="discovery-disclaimer">These are opportunities discovered from the live web. Check the provider's page for current availability and eligibility.</p>
            <div className="results-header"><div><p className="section-kicker"><span>02</span><span>Research results</span></p><h2>What we found</h2></div>{offers.length > 0 && <div className="summary-row"><div><strong>{summary.total}</strong><span>Discovered</span></div><div className="eligible"><strong>{summary.likely}</strong><span>Likely eligible</span></div><div className="verify"><strong>{summary.verify}</strong><span>Needs verification</span></div></div>}</div>
            {error && <div className="error-state"><strong>Research couldn’t finish.</strong><span>{error}</span><button type="button" onClick={handleSubmit}>Retry research</button></div>}
            {!error && offers.length === 0 && <div className="empty-state"><span className="empty-icon">◌</span><strong>No classified offers yet</strong><span>The agent found potential programs but could not establish enough live evidence to classify them.</span><button type="button" onClick={handleSubmit}>Retry research ↗</button></div>}
            {offers.length > 0 && <div className="offer-grid">{offers.map((offer, index) => <article className="offer-card" key={`${offer.officialUrl}-${index}`}><div className="offer-topline"><span className="offer-number">0{index + 1}</span><span className={`source-tag ${offer.sourceType}`}>{offer.sourceType} source</span></div><p className="offer-provider">{offer.provider}</p><h3>{offer.name}</h3><div className="benefit-box"><span>Benefit</span><p>{offer.benefit}</p></div><div className="offer-meta"><span className={`status-pill ${offer.status}`}><i />{statusLabel(offer.status)}</span><span className={`confidence ${offer.confidence}`}>Confidence: {offer.confidence}</span></div><div className="offer-details"><p><b>Why it matches</b>{offer.whyRelevant}</p><p><b>Verification</b>{offer.verification}</p><p><b>Eligibility evidence</b>{offer.eligibilityEvidence}</p><p><b>Country support</b>{offer.countrySupport}</p></div><a className="source-button" href={offer.officialUrl} target="_blank" rel="noreferrer">Open official source <span>↗</span></a></article>)}</div>}
          </section>}
        </div>
      </section>
      <footer><span>Built for students who look twice.</span><span>Live sources only · Evidence before eligibility</span></footer>
    </main>
  );
}
