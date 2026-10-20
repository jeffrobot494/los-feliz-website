<?php
/**
 * LFAR theme setup.
 *
 * Each of the six main pages brings its own stylesheet and script (assets/css/<page>.css, assets/js/<page>.js).
 * They started as a conversion of design/final-mockups but are now edited directly. Other pages (posts,
 * archives, new pages) fall back to the Home styles and assets/js/common.js.
 *
 * @package lfar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const LFAR_PAGES = array( 'home', 'about', 'adopt', 'get-involved', 'contact', 'donate' );

// Instagram feed on About, Get Involved and Adopt (Settings → LFAR Instagram).
require_once get_theme_file_path( 'inc/instagram.php' );

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

/**
 * Fluent Forms ID for one of the site's forms, found by its title (so it survives a move to production).
 * Rename a form in Fluent Forms? Update the title here too.
 *
 * @param string $key adoption | foster | volunteer | contact | newsletter.
 */
function lfar_form_id( $key ) {
	static $ids = null;
	$titles = array(
		'adoption'   => 'Adoption application',
		'foster'     => 'Foster application',
		'volunteer'  => 'Volunteer sign-up',
		'contact'    => 'Contact',
		'newsletter' => 'Newsletter sign-up',
	);
	if ( null === $ids ) {
		global $wpdb;
		$ids   = array();
		$table = $wpdb->prefix . 'fluentform_forms';
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table ) { // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$rows = $wpdb->get_results( "SELECT id, title FROM {$table} ORDER BY id ASC" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			foreach ( $rows as $row ) {
				$k = array_search( $row->title, $titles, true );
				if ( false !== $k && ! isset( $ids[ $k ] ) ) {
					$ids[ $k ] = (int) $row->id;
				}
			}
		}
	}
	return isset( $ids[ $key ] ) ? $ids[ $key ] : 0;
}

/**
 * [lfar_form name="adoption"]: the Fluent Form with that title, looked up each time the page renders.
 * (Writing [fluentform id="3"] into the page would freeze whatever id existed when the page was first saved.)
 */
add_shortcode(
	'lfar_form',
	function ( $atts ) {
		$atts = shortcode_atts( array( 'name' => '' ), $atts, 'lfar_form' );
		$id   = lfar_form_id( $atts['name'] );
		if ( ! $id ) {
			return current_user_can( 'edit_pages' ) ? '<p class="lfar-form-missing">[Form "' . esc_html( $atts['name'] ) . '" not found in Fluent Forms]</p>' : '';
		}
		return do_shortcode( '[fluentform id="' . (int) $id . '"]' );
	}
);

/*
 * Shortcode blocks inside patterns used by templates (e.g. the newsletter form in every page footer)
 * are expanded after WordPress has already processed shortcodes, so run them here.
 */
add_filter(
	'render_block_core/shortcode',
	function ( $content ) {
		return do_shortcode( shortcode_unautop( $content ) );
	}
);

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
		// Same for the paragraph wrapped around a converted text element (span, em, cite...): it adds no box and no styles,
		// so the element sits and looks exactly as in the mockup.
		wp_add_inline_style( 'lfar-base', 'p.lfar-w.lfar-w{all:unset;display:contents}' );
		wp_enqueue_script( 'lfar-page', get_theme_file_uri( $js ), array(), lfar_ver( $js ), array( 'in_footer' => true ) );
		wp_enqueue_style( 'lfar-forms', get_theme_file_uri( 'assets/css/forms.css' ), array( 'lfar-page' ), lfar_ver( 'assets/css/forms.css' ) );
		wp_enqueue_script( 'lfar-forms', get_theme_file_uri( 'assets/js/forms.js' ), array( 'lfar-page' ), lfar_ver( 'assets/js/forms.js' ), array( 'in_footer' => true ) );
		// Adopt: Petfinder's pet list widget (the <pet-scroller> element in the "See all adoptable animals" panel).
		if ( 'adopt' === $key ) {
			wp_enqueue_script( 'petfinder-pet-scroller', 'https://www.petfinder.com/pet-scroller.bundle.js', array(), null, array( 'in_footer' => true ) );
		}
	}
);

// Editor: load the same page styles so pages look like the front end while editing.
add_action(
	'admin_init',
	function () {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$key     = $post_id ? lfar_page_key( $post_id ) : '';
		add_editor_style( array( 'assets/css/base.css', 'assets/css/' . ( $key ? $key : 'home' ) . '.css', 'assets/css/editor.css' ) );
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
