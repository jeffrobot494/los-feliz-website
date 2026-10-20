<?php
/**
 * Featured pet card on the Adopt page. view.js swaps in the "Adopted!" state once the pet leaves Petfinder's adoptable list.
 *
 * @package lfar
 *
 * @var array $attributes Block attributes (block.json).
 */

$lfar_name = $attributes['name'];
// No pet chosen yet: the built-in example, Sherlock, with his photo from the theme.
$lfar_photo = $attributes['photo'] ? $attributes['photo'] : ( $attributes['petId'] ? '' : get_theme_file_uri( 'assets/images/sherlock-a-young-grey-brindle-dog-held-by-his-fo.jpg' ) );

$lfar_wrapper = get_block_wrapper_attributes(
	array(
		'class'         => 'feat-card lfar-anim-fade-down',
		'data-pet-id'   => $attributes['petId'],
		'data-pet-name' => wp_strip_all_tags( $lfar_name ),
	)
);
?>
<div <?php echo $lfar_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
<div class="feat-photo">
<?php if ( $lfar_photo ) : ?>
<figure class="wp-block-image"><img src="<?php echo esc_url( $lfar_photo ); ?>" alt="<?php echo esc_attr( $attributes['alt'] ); ?>"/></figure>
<?php endif; ?>
<span class="feat-tag">Featured pet</span>
</div>
<div class="feat-body custom">
<h3 class="wp-block-heading pet-name">Meet <?php echo wp_kses_post( $lfar_name ); ?></h3>
<p class="pet-facts"><?php echo esc_html( $attributes['facts'] ); ?></p>
<p><?php echo wp_kses_post( $attributes['blurb'] ); ?></p>
<?php if ( $attributes['bullets'] ) : ?>
<ul class="wp-block-list">
<?php foreach ( $attributes['bullets'] as $lfar_bullet ) : ?>
<li><?php echo esc_html( $lfar_bullet ); ?></li>
<?php endforeach; ?>
</ul>
<?php endif; ?>
<?php if ( $attributes['url'] ) : ?>
<a class="pet-story" href="<?php echo esc_url( $attributes['url'] ); ?>" target="_blank" rel="noopener">Read <?php echo wp_kses_post( $lfar_name ); ?>’s full story on Petfinder →</a>
<?php endif; ?>
<button class="btn apply-for" data-pet="<?php echo esc_attr( wp_strip_all_tags( $lfar_name ) ); ?>" data-type="<?php echo esc_attr( $attributes['kind'] ); ?>" type="button">Apply for <?php echo wp_kses_post( $lfar_name ); ?></button>
</div>
</div>
