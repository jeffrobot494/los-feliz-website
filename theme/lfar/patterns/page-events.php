<?php
/**
 * Title: Events page
 * Slug: lfar/page-events
 * Categories: lfar-pages
 * Inserter: yes
 * Post Types: page
 *
 * Upcoming events and a past-events archive. With Instagram connected, both lists
 * are the posts tagged #event (Settings → LFAR Instagram). Until then, the sample
 * event below is the same one the homepage shows.
 */
?>
<!-- wp:group {"templateLock":"contentOnly","tagName":"section","className":"hero"} -->
<section class="wp-block-group hero"><!-- wp:image {"className":"hero-bg"} -->
<figure class="wp-block-image hero-bg"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/a-volunteer-holding-a-small-tan-dog.jpg' ) ); ?>" alt="A volunteer holding a small tan dog"/></figure>
<!-- /wp:image -->

<!-- wp:group {"className":"container"} -->
<div class="wp-block-group container"><!-- wp:group {"className":"hero-card"} -->
<div class="wp-block-group hero-card"><!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Events</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"className":"header-p"} -->
<p class="header-p">What is coming up, and what has already happened.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->

<!-- wp:group {"templateLock":"contentOnly","tagName":"section","className":"fw bg-light section2"} -->
<section class="wp-block-group fw bg-light section2" id="upcoming"><!-- wp:group {"className":"container"} -->
<div class="wp-block-group container"><!-- wp:group {"className":"section-heading"} -->
<div class="wp-block-group section-heading"><!-- wp:heading -->
<h2 class="wp-block-heading">Upcoming events</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"className":"subhead"} -->
<p class="subhead">The next one also stays on the homepage until the event is over.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"className":"news-grid events-upcoming"} -->
<div class="wp-block-group news-grid events-upcoming"><!-- wp:group {"tagName":"article","className":"news-card news-card-empty col-event"} -->
<article class="wp-block-group news-card news-card-empty col-event"><!-- wp:html -->
<div class="thumb thumb-empty"><span class="tag">Next event</span></div>
<!-- /wp:html -->

<!-- wp:group {"className":"news-body"} -->
<div class="wp-block-group news-body"><!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">No upcoming event</h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>The next event stays in this column until it is over.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></article>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->

<!-- wp:group {"templateLock":"contentOnly","tagName":"section","className":"fw section2"} -->
<section class="wp-block-group fw section2" id="past"><!-- wp:group {"className":"container"} -->
<div class="wp-block-group container"><!-- wp:group {"className":"section-heading"} -->
<div class="wp-block-group section-heading"><!-- wp:heading -->
<h2 class="wp-block-heading">Past events</h2>
<!-- /wp:heading --></div>
<!-- /wp:group -->

<!-- wp:group {"className":"news-grid events-past"} -->
<div class="wp-block-group news-grid events-past"><!-- wp:group {"tagName":"article","className":"news-card col-event"} -->
<article class="wp-block-group news-card col-event"><!-- wp:html -->
<div class="thumb">
<span class="tag">Past event</span>
<img alt="A volunteer holding a small tan dog" src="<?php echo esc_url( get_theme_file_uri( 'assets/images/a-volunteer-holding-a-small-tan-dog.jpg' ) ); ?>"/>
</div>
<!-- /wp:html -->

<!-- wp:group {"className":"news-body"} -->
<div class="wp-block-group news-body"><!-- wp:html -->
<div class="meta">
<span><svg viewbox="0 0 24 24"><rect height="16" rx="2" width="18" x="3" y="5"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>Saturday, October 3, 2026 · 11 am – 2 pm</span>
<span><svg viewbox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"></path><circle cx="12" cy="9" r="2.5"></circle></svg>Petco, Los Feliz [store address]</span>
</div>
<!-- /wp:html -->

<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">Adoption Meet &amp; Greet at Petco</h4>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Meet adoptable dogs and cats from our foster homes, talk with our volunteers and pick up an adoption application.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></article>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->
