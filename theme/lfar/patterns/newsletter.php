<?php
/**
 * Title: Newsletter sign-up
 * Slug: lfar/newsletter
 * Categories: lfar-chrome
 * Inserter: yes
 */
?>
<!-- wp:group {"tagName":"section","className":"fw newsletter"} -->
<section class="wp-block-group fw newsletter" id="newsletter"><!-- wp:group {"className":"container"} -->
<div class="wp-block-group container"><!-- wp:group {"className":"nl lfar-anim-fade-up"} -->
<div class="wp-block-group nl lfar-anim-fade-up"><!-- wp:html -->
<div aria-hidden="true" class="nl-paw"></div>
<!-- /wp:html -->

<!-- wp:group -->
<div class="wp-block-group"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading" id="nl-title">Join our newsletter</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Adoptable pets, upcoming events and urgent needs from Los Feliz Animal Rescue, a couple of times a month.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"className":"lfar-nl"} -->
<div class="wp-block-group lfar-nl"><!-- wp:shortcode -->
[fluentform id="<?php echo (int) lfar_form_id( 'newsletter' ); ?>"]
<!-- /wp:shortcode -->

<!-- wp:paragraph {"className":"nl-note"} -->
<p class="nl-note">No spam. Unsubscribe any time.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->
