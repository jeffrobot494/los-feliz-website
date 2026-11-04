<?php
/**
 * Public-site fixes that are not part of a page design: old Google Sites
 * addresses, the site icon, and share tags.
 *
 * @package lfar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Old Google Sites paths (Wayback, 2022) to the closest current page.
 * Keys have no leading or trailing slash. Lookup is case-insensitive.
 *
 * @return array<string,string>
 */
function lfar_legacy_paths() {
	return array(
		'adoptable-animals'                   => '/adopt/',
		'adoptable-animals/fosters-needed'    => '/get-involved/#foster',
		'blog'                                => '/',
		'how-to-helpcontact-us'               => '/contact/',
		'lost-and-found'                      => '/contact/',
		'wildlife'                            => '/contact/',
		'pets-and-owners'                     => '/contact/',
		'pets-and-owners/birds'               => '/adopt/',
		'pets-and-owners/cats'                => '/adopt/',
		'pets-and-owners/dogs'                => '/adopt/',
		'pets-and-owners/other'               => '/adopt/',
		'pets-and-owners/other-small-mammals' => '/adopt/',
		'pets-and-owners/resources'           => '/contact/',
	);
}

/**
 * Request path relative to the site root, lowercased, without a trailing slash.
 */
function lfar_request_path() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	$path = wp_parse_url( $uri, PHP_URL_PATH );
	$path = strtolower( rawurldecode( (string) $path ) );
	$home = trim( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ), '/' );
	$path = trim( $path, '/' );
	if ( $home && 0 === strpos( $path, $home . '/' ) ) {
		$path = substr( $path, strlen( $home ) + 1 );
	} elseif ( $home && $path === $home ) {
		$path = '';
	}
	return $path;
}

/**
 * 301 every old Google Sites address. Query strings are dropped; the fragment
 * in the table (the foster section) is kept.
 */
add_action(
	'template_redirect',
	function () {
		$map  = lfar_legacy_paths();
		$path = lfar_request_path();
		if ( ! isset( $map[ $path ] ) ) {
			return;
		}
		wp_redirect( home_url( $map[ $path ] ), 301 );
		exit;
	},
	0
);

/**
 * Files served at the domain root. Skipped when the owner has set a Site Icon,
 * so that choice is left alone.
 *
 * @return array<string,array{0:string,1:string}>
 */
function lfar_root_icon_files() {
	return array(
		'favicon.ico'                     => array( 'assets/icons/favicon.ico', 'image/x-icon' ),
		'apple-touch-icon.png'            => array( 'assets/icons/apple-touch-icon.png', 'image/png' ),
		'apple-touch-icon-precomposed.png' => array( 'assets/icons/apple-touch-icon-precomposed.png', 'image/png' ),
		'site.webmanifest'                => array( 'assets/icons/site.webmanifest', 'application/manifest+json' ),
	);
}

/**
 * Send one of the root icon files and stop.
 *
 * @param string $rel  Theme-relative path.
 * @param string $type Content-Type.
 */
function lfar_send_theme_file( $rel, $type ) {
	$path = get_theme_file_path( $rel );
	if ( ! is_readable( $path ) ) {
		return;
	}
	status_header( 200 );
	header( 'Content-Type: ' . $type );
	header( 'Content-Length: ' . (string) filesize( $path ) );
	header( 'Cache-Control: public, max-age=604800' );
	header( 'X-Content-Type-Options: nosniff' );
	readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
	exit;
}

/**
 * /favicon.ico is handled by WordPress before a normal template. Serve ours
 * unless a Site Icon is set.
 */
add_action(
	'do_faviconico',
	function () {
		if ( has_site_icon() ) {
			return;
		}
		remove_action( 'do_faviconico', 'wp_favicon_request' );
		$file = lfar_root_icon_files()['favicon.ico'];
		lfar_send_theme_file( $file[0], $file[1] );
	},
	1
);

/**
 * The other root icon addresses are not special to WordPress, so they would 404.
 */
add_action(
	'parse_request',
	function () {
		if ( has_site_icon() ) {
			return;
		}
		$files = lfar_root_icon_files();
		$path  = lfar_request_path();
		if ( isset( $files[ $path ] ) ) {
			lfar_send_theme_file( $files[ $path ][0], $files[ $path ][1] );
		}
	}
);

/**
 * An SEO plugin already prints description and share tags.
 */
function lfar_seo_plugin_active() {
	return defined( 'WPSEO_VERSION' )
		|| defined( 'RANK_MATH_VERSION' )
		|| defined( 'SEOPRESS_VERSION' )
		|| defined( 'AIOSEO_VERSION' )
		|| defined( 'THE_SEO_FRAMEWORK_VERSION' )
		|| defined( 'SLIM_SEO_VER' );
}

/**
 * Share copy taken from each page's own introduction. The eighth page is the 404.
 *
 * @return array{title:string,description:string,url:string}|null
 */
function lfar_share_meta() {
	$descriptions = array(
		'home'         => 'Los Feliz Animal Rescue is dedicated to creating a community full of healthy and happy animals, regardless of species or domestication.',
		'adopt'        => 'See who is looking for a home, or start an application.',
		'events'       => 'What is coming up, and what has already happened.',
		'get-involved' => 'Every animal we save is cared for by neighbors. Drive a pup to the vet, take photos, work an adoption event or give what you can.',
		'about'        => 'We\'re not a shelter. We\'re a network of foster homes, run by neighbors from East Hollywood to the LA River.',
		'contact'      => 'We\'re a volunteer team, so a message is the best way to reach us. We usually reply within 2–3 days.',
		'donate'       => 'A foster home doesn\'t cost a thing. Everything else an animal needs takes donations. See what yours buys.',
	);
	if ( is_404() ) {
		return array(
			'title'       => 'Page not found – ' . get_bloginfo( 'name' ),
			'description' => 'We couldn\'t find that page. Try the home page or see our adoptable animals.',
			'url'         => home_url( '/' . lfar_request_path() . '/' ),
		);
	}
	$key = lfar_page_key();
	if ( ! isset( $descriptions[ $key ] ) ) {
		return null;
	}
	return array(
		'title'       => wp_get_document_title(),
		'description' => $descriptions[ $key ],
		'url'         => 'home' === $key ? home_url( '/' ) : get_permalink(),
	);
}

/**
 * Meta description, Open Graph, and Twitter tags. Omitted when an SEO plugin is active.
 */
add_action(
	'wp_head',
	function () {
		if ( lfar_seo_plugin_active() ) {
			return;
		}
		$meta = lfar_share_meta();
		if ( ! $meta ) {
			return;
		}
		$image = get_theme_file_uri( 'assets/images/a-volunteer-holding-a-small-tan-dog.jpg' );
		$tags  = array(
			array( 'name', 'description', $meta['description'] ),
			array( 'property', 'og:title', $meta['title'] ),
			array( 'property', 'og:description', $meta['description'] ),
			array( 'property', 'og:url', $meta['url'] ),
			array( 'property', 'og:image', $image ),
			array( 'property', 'og:type', 'website' ),
			array( 'name', 'twitter:card', 'summary_large_image' ),
			array( 'name', 'twitter:title', $meta['title'] ),
			array( 'name', 'twitter:description', $meta['description'] ),
			array( 'name', 'twitter:image', $image ),
		);
		foreach ( $tags as $tag ) {
			printf(
				'<meta %s="%s" content="%s" />' . "\n",
				esc_attr( $tag[0] ),
				esc_attr( $tag[1] ),
				esc_attr( $tag[2] )
			);
		}
	},
	1
);

/**
 * Head links for the theme icon. A Site Icon set in WordPress replaces these.
 */
add_action(
	'wp_head',
	function () {
		if ( has_site_icon() ) {
			return;
		}
		$icons = array(
			array( 'icon', home_url( '/favicon.ico' ), 'image/x-icon', '' ),
			array( 'icon', get_theme_file_uri( 'assets/icons/favicon.svg' ), 'image/svg+xml', '' ),
			array( 'icon', get_theme_file_uri( 'assets/icons/favicon-32.png' ), 'image/png', '32x32' ),
			array( 'apple-touch-icon', home_url( '/apple-touch-icon.png' ), 'image/png', '180x180' ),
			array( 'manifest', home_url( '/site.webmanifest' ), '', '' ),
		);
		foreach ( $icons as $icon ) {
			$sizes = $icon[3] ? ' sizes="' . esc_attr( $icon[3] ) . '"' : '';
			$type  = $icon[2] ? ' type="' . esc_attr( $icon[2] ) . '"' : '';
			printf(
				'<link rel="%s" href="%s"%s%s />' . "\n",
				esc_attr( $icon[0] ),
				esc_url( $icon[1] ),
				$type, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				$sizes // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			);
		}
	},
	2
);
