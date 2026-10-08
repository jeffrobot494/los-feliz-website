<?php
/**
 * LFAR theme setup.
 *
 * Each mockup page brings its own stylesheet and script (assets/css/<page>.css, assets/js/<page>.js),
 * generated from design/final-mockups by scripts/build-wp-theme.py. Pages that aren't one of the six
 * mockups (posts, archives, new pages) fall back to the Home styles and assets/js/common.js.
 *
 * @package lfar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const LFAR_PAGES = array( 'home', 'about', 'adopt', 'get-involved', 'contact', 'donate' );

/**
 * Which mockup a page belongs to, or '' if none.
 *
 * @param int $post_id Optional post ID (used in the editor). Omit on the front end.
 */
function lfar_page_key( $post_id = 0 ) {
	if ( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return '';
		}
		if ( (int) get_option( 'page_on_front' ) === (int) $post->ID ) {
			return 'home';
		}
		return ( 'page' === $post->post_type && in_array( $post->post_name, LFAR_PAGES, true ) ) ? $post->post_name : '';
	}
	if ( is_front_page() ) {
		return 'home';
	}
	if ( is_page() ) {
		$slug = get_post_field( 'post_name', get_queried_object_id() );
		if ( in_array( $slug, LFAR_PAGES, true ) ) {
			return $slug;
		}
	}
	return '';
}

/** Cache-busting version: the file's modified time. */
function lfar_ver( $rel ) {
	$path = get_theme_file_path( $rel );
	return file_exists( $path ) ? (string) filemtime( $path ) : wp_get_theme()->get( 'Version' );
}

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'editor-styles' );
		add_theme_support( 'wp-block-styles' );
	}
);

add_action(
	'wp_enqueue_scripts',
	function () {
		$key = lfar_page_key();
		$css = 'assets/css/' . ( $key ? $key : 'home' ) . '.css';
		$js  = 'assets/js/' . ( $key ? $key : 'common' ) . '.js';
		wp_enqueue_style( 'lfar-base', get_theme_file_uri( 'assets/css/base.css' ), array(), lfar_ver( 'assets/css/base.css' ) );
		wp_enqueue_style( 'lfar-page', get_theme_file_uri( $css ), array( 'lfar-base' ), lfar_ver( $css ) );
		// Front end only: the paragraph wrapped around stand-alone links/buttons steps out of the layout,
		// so the link sits in flex/grid rows exactly as in the mockups. (Kept out of the editor so the block stays selectable.)
		wp_add_inline_style( 'lfar-base', 'p.lfar-a.lfar-a{display:contents}' );
		wp_enqueue_script( 'lfar-page', get_theme_file_uri( $js ), array(), lfar_ver( $js ), array( 'in_footer' => true ) );
	}
);

// Editor: load the same page styles so pages look like the front end while editing.
add_action(
	'admin_init',
	function () {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$key     = $post_id ? lfar_page_key( $post_id ) : '';
		add_editor_style( array( 'assets/css/base.css', 'assets/css/' . ( $key ? $key : 'home' ) . '.css' ) );
	}
);

add_action(
	'init',
	function () {
		register_block_pattern_category( 'lfar-pages', array( 'label' => __( 'LFAR pages', 'lfar' ) ) );
		register_block_pattern_category( 'lfar-chrome', array( 'label' => __( 'LFAR site sections', 'lfar' ) ) );
		register_block_style( 'core/image', array( 'name' => 'blob', 'label' => __( 'Blob', 'lfar' ) ) );
		register_block_style( 'core/image', array( 'name' => 'irregular', 'label' => __( 'Irregular', 'lfar' ) ) );
	}
);

/**
 * One-time setup: create the six pages, make Home the front page, add the News and Happy Tails categories.
 *
 * New pages hold a reference to their theme pattern, so they render straight from patterns/page-*.php
 * until someone edits them in the block editor (then the blocks are saved into the page).
 * Re-run by deleting the lfar_seeded option (wp option delete lfar_seeded).
 */
add_action(
	'admin_init',
	function () {
		if ( get_option( 'lfar_seeded' ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$titles = array(
			'home'         => 'Home',
			'about'        => 'About',
			'adopt'        => 'Adopt',
			'get-involved' => 'Get Involved',
			'contact'      => 'Contact',
			'donate'       => 'Donate',
		);
		$ids    = array();
		foreach ( $titles as $slug => $title ) {
			$existing = get_page_by_path( $slug );
			if ( $existing ) {
				$ids[ $slug ] = $existing->ID;
				continue;
			}
			$ids[ $slug ] = wp_insert_post(
				array(
					'post_type'    => 'page',
					'post_status'  => 'publish',
					'post_title'   => $title,
					'post_name'    => $slug,
					'post_content' => '<!-- wp:pattern {"slug":"lfar/page-' . $slug . '"} /-->',
				)
			);
		}
		if ( ! empty( $ids['home'] ) && ! is_wp_error( $ids['home'] ) ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', (int) $ids['home'] );
		}
		foreach ( array( 'news' => 'News', 'happy-tails' => 'Happy Tails' ) as $slug => $name ) {
			if ( ! term_exists( $slug, 'category' ) ) {
				wp_insert_term( $name, 'category', array( 'slug' => $slug ) );
			}
		}
		update_option( 'lfar_seeded', 1 );
	}
);
