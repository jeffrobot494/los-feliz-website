<?php
/**
 * LFAR Instagram feed.
 *
 * Reads LFAR's own Instagram posts through the Instagram API with Facebook login (Graph API),
 * once an hour, and shows them on four pages:
 *   Home          three columns: next #event (until that event is over), newest #update, newest urgent need
 *   Events        upcoming #event posts and a past-events archive
 *   Home          featured Happy Tail (newest Adopt story)
 *   About         "In the News & Around the Rescue"  (the #feed-grid cards)
 *   Get Involved  "Volunteers in Action"              (the #feed-grid cards)
 *   Adopt         "Happy Endings and Counting"        (the Happy Tails list)
 *
 * Which post goes where: each section has "site tags" (Melody adds one of these on purpose) and
 * "fallback" matches (tags she already uses, plus adoption phrases for Happy Tails). Site-tagged
 * posts come first, newest first; fallback matches fill the remaining slots. All lists are edited
 * at Settings → LFAR Instagram, where posts can also be hidden one by one.
 *
 * The access token is a Facebook Page token (does not expire). It is stored in the lfar_ig_token
 * option, or, on production, can be set in wp-config.php as define( 'LFAR_IG_TOKEN', '...' ).
 * Never commit it to git.
 *
 * The theme's page patterns keep the mockup sample posts; the live posts are swapped in
 * while the blocks render.
 *
 * @package lfar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const LFAR_IG_API      = 'https://graph.facebook.com/v26.0/';
const LFAR_IG_DEFAULT  = '17841452720898897'; // LFAR's Instagram business account (linked to Page 102854905728087).
const LFAR_IG_KEEP     = 200;                 // Posts kept in the local store.
const LFAR_IG_PAGES    = 2;                   // API pages of 50 read per update (newest 100 posts).
const LFAR_IG_DL_LIMIT = 25;                  // Images downloaded per update (the rest come next hour).

/* -------------------------------------------------------------------------
 * Settings
 * ---------------------------------------------------------------------- */

/** Default sections. Tags are written without '#', any capitalization. */
function lfar_ig_default_settings() {
	return array(
		'account_id'  => LFAR_IG_DEFAULT,
		// Homepage columns. Written without '#'. The event column is not "the latest post":
		// it keeps the next event until the date in the caption has passed (or, if the caption
		// has no date, until a newer #event post replaces it).
		'event_tags'  => 'event events',
		'update_tags' => 'update news',
		'urgent_tags' => 'urgentneed urgent fosterneeded fostersneeded fosterneededasap volunteersneeded volunteerneeded',
		'urgent_days' => 7,
		'sections'    => array(
			'about'        => array(
				'site'     => 'inthenews allstar mission volunteer',
				'fallback' => '*',
				'phrases'  => 0,
				'max'      => 9,
			),
			'get-involved' => array(
				'site'     => 'allstar volunteersneeded volunteer fosterneeded',
				'fallback' => 'fosterneeded fostersneeded fosterssavelives fosteringsaveslives volunteers volunteering volunteerlife',
				'phrases'  => 0,
				'max'      => 6,
			),
			'adopt'        => array(
				'site'     => 'happytales happytails',
				'fallback' => 'adopted gotadopted fureverhome foreverhome',
				'phrases'  => 1,
				'max'      => 12,
			),
		),
	);
}

/** Section labels for the settings screen. */
function lfar_ig_section_labels() {
	return array(
		'about'        => 'About page: In the News &amp; Around the Rescue',
		'get-involved' => 'Get Involved page: Volunteers in Action',
		'adopt'        => 'Adopt page: Happy Tails',
	);
}

/**
 * One-time merge for installs that saved Settings → LFAR Instagram before the
 * column tags existed. Saved urgent_tags replace the defaults, so #urgentneed
 * would never match until someone re-saved. Missing event/update lists get the
 * new defaults. A later save can still remove a tag; this does not put it back.
 */
function lfar_ig_migrate_saved_tags( $saved, $defaults ) {
	if ( (int) get_option( 'lfar_ig_tag_rev' ) >= 2 ) {
		return $saved;
	}
	if ( is_array( $saved ) && $saved ) {
		foreach ( array( 'event_tags', 'update_tags' ) as $key ) {
			if ( ! isset( $saved[ $key ] ) || '' === trim( (string) $saved[ $key ] ) ) {
				$saved[ $key ] = $defaults[ $key ];
			}
		}
		$urgent = lfar_ig_tag_list( isset( $saved['urgent_tags'] ) ? $saved['urgent_tags'] : '' );
		if ( ! in_array( 'urgentneed', $urgent, true ) ) {
			$saved['urgent_tags'] = trim( ( isset( $saved['urgent_tags'] ) ? $saved['urgent_tags'] : '' ) . ' urgentneed' );
		}
		update_option( 'lfar_ig_settings', $saved, false );
	}
	update_option( 'lfar_ig_tag_rev', 2, false );
	return is_array( $saved ) ? $saved : array();
}

function lfar_ig_settings() {
	$d = lfar_ig_default_settings();
	$s = get_option( 'lfar_ig_settings', array() );
	$s = lfar_ig_migrate_saved_tags( is_array( $s ) ? $s : array(), $d );
	$out = array_merge( $d, array_intersect_key( $s, $d ) );
	foreach ( $d['sections'] as $k => $sec ) {
		$saved                 = isset( $s['sections'][ $k ] ) && is_array( $s['sections'][ $k ] ) ? $s['sections'][ $k ] : array();
		$out['sections'][ $k ] = array_merge( $sec, array_intersect_key( $saved, $sec ) );
	}
	return $out;
}

function lfar_ig_token() {
	if ( defined( 'LFAR_IG_TOKEN' ) && LFAR_IG_TOKEN ) {
		return (string) LFAR_IG_TOKEN;
	}
	return (string) get_option( 'lfar_ig_token', '' );
}

/** Turn "#InTheNews, allstar  Mission" into array( 'inthenews', 'allstar', 'mission' ). '*' means any post. */
function lfar_ig_tag_list( $text ) {
	$out = array();
	foreach ( preg_split( '/[\s,]+/u', strtolower( (string) $text ) ) as $t ) {
		$t = ltrim( trim( $t ), '#' );
		if ( '*' === $t || preg_match( '/^[\p{L}\p{N}_]+$/u', $t ) ) {
			$out[ $t ] = true;
		}
	}
	return array_keys( $out );
}

/* -------------------------------------------------------------------------
 * Caption parsing
 * ---------------------------------------------------------------------- */

/**
 * Hashtags in a caption: lowercase => as written. Emoji after a tag (#adoptdontshop❤️) are ignored.
 */
function lfar_ig_hashtags( $caption ) {
	$tags = array();
	if ( preg_match_all( '/#([\p{L}\p{N}_]+)/u', (string) $caption, $m ) ) {
		foreach ( $m[1] as $t ) {
			$k = mb_strtolower( $t );
			if ( ! isset( $tags[ $k ] ) ) {
				$tags[ $k ] = $t;
			}
		}
	}
	return $tags;
}

/** preg_replace that keeps the original text if the pattern fails (instead of returning null). */
function lfar_ig_re( $pattern, $replacement, $text ) {
	$out = preg_replace( $pattern, $replacement, (string) $text );
	return null === $out ? (string) $text : $out;
}

/** Shorten at a word boundary. */
function lfar_ig_shorten( $text, $max ) {
	if ( mb_strlen( $text ) <= $max ) {
		return $text;
	}
	$cut = mb_substr( $text, 0, $max );
	$sp  = mb_strrpos( $cut, ' ' );
	if ( false !== $sp && $sp > $max * 0.6 ) {
		$cut = mb_substr( $cut, 0, $sp );
	}
	return rtrim( $cut, " ,;:-–—" ) . '…';
}

/**
 * Card title and excerpt from a caption.
 *
 * Melody's captions are a paragraph, then a "." "." "." separator, a line of @mentions and the hashtags.
 * Everything from the separator on is dropped, as are lines that are only @mentions or #tags.
 * Title = first sentence (a very short opener like "HELP!" takes the next sentence too; a long
 * "Good news: Statler has found his home!" uses the part after the colon). Excerpt = what follows.
 *
 * @return array{title:string,text:string}
 */
function lfar_ig_parse_caption( $caption, $text_max = 160 ) {
	$keep = array();
	foreach ( preg_split( '/\R/u', (string) $caption ) as $line ) {
		$t = trim( $line );
		if ( '' === $t ) {
			continue;
		}
		if ( preg_match( '/^[.\-•·_~*…]+$/u', $t ) ) {
			break; // Separator: the rest is mentions and tags.
		}
		$rest = lfar_ig_re( '/[@#][\p{L}\p{N}_.]++/u', '', $t );
		if ( ! preg_match( '/[\p{L}\p{N}]/u', $rest ) ) {
			continue; // Only @mentions / #tags / emoji.
		}
		$keep[] = $t;
	}
	$text = implode( ' ', $keep );
	// Possessive quantifiers (++ *+) so long runs of tags can't send the pattern into endless backtracking.
	$text = lfar_ig_re( '/(?:\s*+#[\p{L}\p{N}_]++\S*+)++\s*+$/u', '', $text ); // Trailing tag cluster.
	$text = lfar_ig_re( '/\s++([!?.,;:])/u', '$1', $text );                         // "foster @name !" → "@name!"
	$text = trim( lfar_ig_re( '/\s++/u', ' ', $text ) );

	if ( '' === $text ) {
		return array( 'title' => 'From our Instagram', 'text' => '' );
	}

	$sentences = preg_split( '/(?<=[.!?])\s++(?=\S)/u', $text ) ?: array( $text );
	$title     = array_shift( $sentences );
	if ( mb_strlen( $title ) < 25 && $sentences ) {
		$title .= ' ' . array_shift( $sentences );
	}
	if ( mb_strlen( $title ) > 60 && preg_match( '/^[^:]{8,}:\s+(.{15,})$/u', $title, $m ) ) {
		$title = mb_strtoupper( mb_substr( $m[1], 0, 1 ) ) . mb_substr( $m[1], 1 );
	}
	return array(
		'title' => lfar_ig_shorten( $title, 90 ),
		'text'  => lfar_ig_shorten( implode( ' ', $sentences ), $text_max ),
	);
}

/** Does the caption read like an adoption announcement? (Happy Tails fallback.) */
function lfar_ig_is_adoption_story( $caption ) {
	$c = mb_strtolower( (string) $caption );
	if ( preg_match( '/\b(?:has|have|finally)?\s*found\s+(?:his|her|their|a|its)?\s*(?:furever|forever|new|perfect)?\s*(?:home|family)\b/u', $c, $m ) && false === strpos( $m[0], 'foster' ) ) {
		return true;
	}
	if ( preg_match( '/\b(?:got|been|was|were|is|are|officially|just)\s+adopted\b/u', $c ) ) {
		return true;
	}
	return (bool) preg_match( '/\b(?:adoption day|gotcha day|went home with|going home with)\b/u', $c );
}

/* -------------------------------------------------------------------------
 * Which posts go where
 * ---------------------------------------------------------------------- */

/**
 * Posts for one section, in display order.
 *
 * Each item: the stored post plus 'label' (tag shown on the card), 'urgent' (bool), 'parsed' (title/text).
 *
 * @param string $key about | get-involved | adopt.
 */
function lfar_ig_section_posts( $key ) {
	$settings = lfar_ig_settings();
	if ( empty( $settings['sections'][ $key ] ) ) {
		return array();
	}
	$sec      = $settings['sections'][ $key ];
	$site     = lfar_ig_tag_list( $sec['site'] );
	$fallback = lfar_ig_tag_list( $sec['fallback'] );
	$any      = in_array( '*', $fallback, true );
	$urgent   = lfar_ig_tag_list( $settings['urgent_tags'] );
	$cutoff   = time() - max( 1, (int) $settings['urgent_days'] ) * DAY_IN_SECONDS;
	$hidden   = array_flip( (array) get_option( 'lfar_ig_hidden', array() ) );
	$posts    = (array) get_option( 'lfar_ig_posts', array() );

	$primary = array();
	$second  = array();
	foreach ( $posts as $p ) {
		if ( isset( $hidden[ $p['id'] ] ) || empty( $p['image'] ) ) {
			continue; // Hidden by hand, or its image isn't saved yet.
		}
		$tags      = lfar_ig_hashtags( $p['caption'] );
		$is_urgent = (bool) array_intersect( $urgent, array_keys( $tags ) );
		if ( $is_urgent && $p['ts'] < $cutoff ) {
			continue; // Calls for help go stale.
		}
		$p['urgent'] = $is_urgent;
		$p['parsed'] = lfar_ig_parse_caption( $p['caption'] );

		$hit = array_values( array_intersect( $site, array_keys( $tags ) ) );
		if ( $hit ) {
			$p['label'] = '#' . $tags[ $hit[0] ];
			$primary[]  = $p;
			continue;
		}
		$hit = array_values( array_intersect( $fallback, array_keys( $tags ) ) );
		if ( $hit ) {
			$p['label'] = '#' . $tags[ $hit[0] ];
			$second[]   = $p;
		} elseif ( ! empty( $sec['phrases'] ) && lfar_ig_is_adoption_story( $p['caption'] ) ) {
			$p['label'] = '';
			$second[]   = $p;
		} elseif ( $any ) {
			$p['label'] = '';
			$second[]   = $p;
		}
	}
	$by_date = function ( $a, $b ) {
		return $b['ts'] <=> $a['ts'];
	};
	usort( $primary, $by_date );
	usort( $second, $by_date );
	return array_slice( array_merge( $primary, $second ), 0, max( 1, (int) $sec['max'] ) );
}

/**
 * Saved posts that carry any of the given tags (space-separated, no '#').
 * Each item is the stored post plus 'parsed' (title/text).
 *
 * @param string $tag_text
 * @return array<int,array>
 */
function lfar_ig_posts_with_tags( $tag_text ) {
	$want   = lfar_ig_tag_list( $tag_text );
	$hidden = array_flip( (array) get_option( 'lfar_ig_hidden', array() ) );
	$out    = array();
	if ( ! $want ) {
		return $out;
	}
	foreach ( (array) get_option( 'lfar_ig_posts', array() ) as $p ) {
		if ( isset( $hidden[ $p['id'] ] ) || empty( $p['image'] ) ) {
			continue;
		}
		$tags = lfar_ig_hashtags( $p['caption'] );
		if ( ! array_intersect( $want, array_keys( $tags ) ) ) {
			continue;
		}
		$p['parsed'] = lfar_ig_parse_caption( $p['caption'] );
		$out[]       = $p;
	}
	return $out;
}

/** Minutes from midnight for "2 pm" / "11:30 a.m." */
function lfar_ig_clock_minutes( $hour, $min, $ap ) {
	$h = (int) $hour;
	$m = (int) $min;
	if ( 'pm' === $ap && $h < 12 ) {
		$h += 12;
	}
	if ( 'am' === $ap && 12 === $h ) {
		$h = 0;
	}
	if ( $h > 23 || $m > 59 ) {
		return null;
	}
	return $h * 60 + $m;
}

/**
 * Start and end of an event named in a caption.
 *
 * The post time is when it was published, not when the event happens.
 * Examples: "October 3, 2026", "Oct 3–5, 2026", "Saturday, November 14, 2026 · 11 am – 2 pm",
 * "2026-10-03", "10/3/2026". A month and day with no year uses the post's year, or the
 * next year if that date already passed. Returns null when the caption has no date.
 *
 * 'end' is when the event is over (later clock time, or end of the last day).
 * 'start' is the first date and the first clock time. 'has_time' is true when a caption
 * includes a clock time, so the card can show "11:00 am – 2:00 pm" instead of only the end.
 *
 * @param string $caption
 * @param int    $posted_ts
 * @return array{start:int,end:int,has_time:bool}|null
 */
function lfar_ig_event_window( $caption, $posted_ts ) {
	$caption = str_replace( array( "–", "—" ), '-', (string) $caption );
	$months  = array(
		'january' => 1, 'february' => 2, 'march' => 3, 'april' => 4, 'may' => 5, 'june' => 6,
		'july' => 7, 'august' => 8, 'september' => 9, 'october' => 10, 'november' => 11, 'december' => 12,
		'jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'jun' => 6, 'jul' => 7, 'aug' => 8,
		'sept' => 9, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12,
	);
	$found = array();
	if ( preg_match_all( '/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*-\s*(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s+(\d{4}))?/iu', $caption, $mm, PREG_SET_ORDER ) ) {
		foreach ( $mm as $m ) {
			$day  = (int) $m[2];
			$day2 = ( isset( $m[3] ) && '' !== $m[3] ) ? (int) $m[3] : $day;
			$year = ( isset( $m[4] ) && '' !== $m[4] ) ? (int) $m[4] : 0;
			$mon  = $months[ strtolower( $m[1] ) ];
			$found[] = array( $year, $mon, min( $day, $day2 ) );
			if ( $day2 !== $day ) {
				$found[] = array( $year, $mon, max( $day, $day2 ) );
			}
		}
	}
	if ( preg_match_all( '/\b(\d{4})-(\d{2})-(\d{2})\b/', $caption, $mm, PREG_SET_ORDER ) ) {
		foreach ( $mm as $m ) {
			$found[] = array( (int) $m[1], (int) $m[2], (int) $m[3] );
		}
	}
	if ( preg_match_all( '/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/', $caption, $mm, PREG_SET_ORDER ) ) {
		foreach ( $mm as $m ) {
			$year = (int) $m[3];
			if ( $year < 100 ) {
				$year += 2000;
			}
			$found[] = array( $year, (int) $m[1], (int) $m[2] ); // US month/day/year.
		}
	}
	if ( ! $found ) {
		return null;
	}

	$tz     = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'America/Los_Angeles' );
	$posted = ( new DateTimeImmutable( '@' . (int) $posted_ts ) )->setTimezone( $tz );
	$dates  = array();
	foreach ( $found as $f ) {
		$year = $f[0];
		if ( ! $year ) {
			$year = (int) $posted->format( 'Y' );
			$try  = DateTimeImmutable::createFromFormat( '!Y-n-j', $year . '-' . $f[1] . '-' . $f[2], $tz );
			if ( $try && $try->getTimestamp() < ( (int) $posted_ts - 2 * DAY_IN_SECONDS ) ) {
				$year++;
			}
		}
		$dt = DateTimeImmutable::createFromFormat( '!Y-n-j', $year . '-' . $f[1] . '-' . $f[2], $tz );
		if ( ! $dt || (int) $dt->format( 'n' ) !== (int) $f[1] || (int) $dt->format( 'j' ) !== (int) $f[2] ) {
			continue;
		}
		$dates[] = $dt;
	}
	if ( ! $dates ) {
		return null;
	}
	usort(
		$dates,
		function ( $a, $b ) {
			return $a->getTimestamp() <=> $b->getTimestamp();
		}
	);
	$start_day = $dates[0];
	$end_day   = $dates[ count( $dates ) - 1 ];

	$minutes = array();
	if ( preg_match_all( '/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/iu', $caption, $tm, PREG_SET_ORDER ) ) {
		foreach ( $tm as $t ) {
			$min = lfar_ig_clock_minutes( $t[1], ( isset( $t[2] ) && '' !== $t[2] ) ? $t[2] : 0, 'p' === strtolower( $t[3][0] ) ? 'pm' : 'am' );
			if ( null !== $min ) {
				$minutes[] = $min;
			}
		}
	}
	$has_time = (bool) $minutes;
	if ( count( $minutes ) >= 2 ) {
		$first = $minutes[0];
		$last  = $minutes[ count( $minutes ) - 1 ];
		$start = $start_day->setTime( intdiv( $first, 60 ), $first % 60, 0 );
		$end   = $end_day->setTime( intdiv( $last, 60 ), $last % 60, 0 );
		if ( $end < $start ) {
			$end = $end_day->setTime( 23, 59, 59 );
		}
	} elseif ( 1 === count( $minutes ) ) {
		$only  = $minutes[0];
		$start = $start_day->setTime( intdiv( $only, 60 ), $only % 60, 0 );
		$end   = $end_day->setTime( 23, 59, 59 );
	} else {
		$start = $start_day->setTime( 0, 0, 0 );
		$end   = $end_day->setTime( 23, 59, 59 );
	}
	return array(
		'start'    => $start->getTimestamp(),
		'end'      => $end->getTimestamp(),
		'has_time' => $has_time,
	);
}

/** @deprecated Use lfar_ig_event_window(). */
function lfar_ig_event_end_ts( $caption, $posted_ts ) {
	$window = lfar_ig_event_window( $caption, $posted_ts );
	return $window ? $window['end'] : null;
}

/**
 * #event posts split into upcoming and past.
 *
 * A caption with a date is upcoming until that moment has passed.
 * A caption with no date stays upcoming only while it is the newest event post
 * ("until our next event post"). Older undated posts, and dated posts whose
 * date has passed, are the archive.
 *
 * @param array<int,array>|null $posts
 * @return array{upcoming:array,past:array}
 */
function lfar_ig_events_split( $posts = null ) {
	if ( null === $posts ) {
		$settings = lfar_ig_settings();
		$posts    = lfar_ig_posts_with_tags( $settings['event_tags'] );
	}
	$now      = time();
	$dated_up = array();
	$past     = array();
	$undated  = array();
	$newest   = null;
	foreach ( $posts as $p ) {
		$window             = lfar_ig_event_window( $p['caption'], $p['ts'] );
		$p['event_start']   = $window ? $window['start'] : null;
		$p['event_end']     = $window ? $window['end'] : null;
		$p['event_has_time'] = $window ? $window['has_time'] : false;
		if ( null === $p['event_end'] ) {
			$undated[] = $p;
		} elseif ( $p['event_end'] >= $now ) {
			$dated_up[] = $p;
		} else {
			$past[] = $p;
		}
		if ( ! $newest || $p['ts'] > $newest['ts'] ) {
			$newest = $p;
		}
	}
	usort(
		$dated_up,
		function ( $a, $b ) {
			return $a['event_end'] <=> $b['event_end'];
		}
	);
	usort(
		$past,
		function ( $a, $b ) {
			return $b['event_end'] <=> $a['event_end'];
		}
	);
	usort(
		$undated,
		function ( $a, $b ) {
			return $b['ts'] <=> $a['ts'];
		}
	);
	$upcoming = $dated_up;
	if ( $undated && $newest && null === $newest['event_end'] && $undated[0]['id'] === $newest['id'] ) {
		$upcoming[] = array_shift( $undated );
	}
	foreach ( $undated as $p ) {
		$past[] = $p;
	}
	return array(
		'upcoming' => $upcoming,
		'past'     => array_slice( $past, 0, 24 ),
	);
}

/**
 * The three homepage columns. Each value is one post or null.
 * Event wins over the other columns when a post has more than one of these tags.
 *
 * @return array{event:?array,update:?array,urgent:?array}
 */
function lfar_ig_home_columns() {
	$settings = lfar_ig_settings();
	$events   = lfar_ig_events_split();
	$event    = $events['upcoming'] ? $events['upcoming'][0] : null;
	$skip     = $event ? array( $event['id'] => true ) : array();

	$urgent = null;
	$cutoff = time() - max( 1, (int) $settings['urgent_days'] ) * DAY_IN_SECONDS;
	$cands  = lfar_ig_posts_with_tags( $settings['urgent_tags'] );
	usort(
		$cands,
		function ( $a, $b ) {
			return $b['ts'] <=> $a['ts'];
		}
	);
	foreach ( $cands as $p ) {
		if ( isset( $skip[ $p['id'] ] ) || $p['ts'] < $cutoff ) {
			continue;
		}
		$urgent            = $p;
		$skip[ $p['id'] ]  = true;
		break;
	}

	$update = null;
	$cands  = lfar_ig_posts_with_tags( $settings['update_tags'] );
	usort(
		$cands,
		function ( $a, $b ) {
			return $b['ts'] <=> $a['ts'];
		}
	);
	foreach ( $cands as $p ) {
		if ( isset( $skip[ $p['id'] ] ) ) {
			continue;
		}
		$update = $p;
		break;
	}

	return array(
		'event'  => $event,
		'update' => $update,
		'urgent' => $urgent,
	);
}

/** Live mode: a token is set and at least one update has succeeded. Until then the mockup samples stay. */
function lfar_ig_live() {
	return '' !== lfar_ig_token() && (bool) get_option( 'lfar_ig_posts' );
}

function lfar_ig_profile_url() {
	$u = get_option( 'lfar_ig_username', '' );
	return $u ? 'https://www.instagram.com/' . rawurlencode( $u ) . '/' : 'https://www.instagram.com/';
}

/* -------------------------------------------------------------------------
 * Fetching
 * ---------------------------------------------------------------------- */

/** GET a Graph API URL. Returns decoded array or WP_Error (code 'ig190' when the token is no longer valid). */
function lfar_ig_get( $url ) {
	$res = wp_remote_get( $url, array( 'timeout' => 20 ) );
	if ( is_wp_error( $res ) ) {
		return $res;
	}
	$body = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( ! is_array( $body ) ) {
		return new WP_Error( 'ig', 'Instagram sent back something unexpected (HTTP ' . wp_remote_retrieve_response_code( $res ) . ').' );
	}
	if ( isset( $body['error'] ) ) {
		$code = isset( $body['error']['code'] ) ? (int) $body['error']['code'] : 0;
		$msg  = isset( $body['error']['message'] ) ? $body['error']['message'] : 'Unknown error';
		// Never echo the token back: Meta's messages don't include it, but strip anything token-shaped anyway.
		$msg = preg_replace( '/EA[A-Za-z0-9]{20,}/', '[token]', $msg );
		return new WP_Error( 190 === $code ? 'ig190' : 'ig', $msg );
	}
	return $body;
}

/** Where saved images live. */
function lfar_ig_upload_dir() {
	$u = wp_upload_dir( null, false );
	return array(
		'path' => trailingslashit( $u['basedir'] ) . 'lfar-instagram',
		'url'  => trailingslashit( $u['baseurl'] ) . 'lfar-instagram',
	);
}

/** Best image URL for a media item: photos use media_url, videos their thumbnail, carousels their first photo. */
function lfar_ig_image_source( $m ) {
	if ( 'VIDEO' === $m['media_type'] ) {
		return isset( $m['thumbnail_url'] ) ? $m['thumbnail_url'] : '';
	}
	if ( 'CAROUSEL_ALBUM' === $m['media_type'] && ! empty( $m['children']['data'] ) ) {
		foreach ( $m['children']['data'] as $c ) {
			if ( 'IMAGE' === $c['media_type'] && ! empty( $c['media_url'] ) ) {
				return $c['media_url'];
			}
		}
		$c = $m['children']['data'][0];
		return ! empty( $c['thumbnail_url'] ) ? $c['thumbnail_url'] : ( isset( $c['media_url'] ) ? $c['media_url'] : '' );
	}
	return isset( $m['media_url'] ) ? $m['media_url'] : '';
}

/** Save a resized copy of an Instagram image (their URLs expire). Returns the file name or ''. */
function lfar_ig_save_image( $id, $src ) {
	if ( ! $src ) {
		return '';
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	$dir = lfar_ig_upload_dir();
	if ( ! wp_mkdir_p( $dir['path'] ) ) {
		return '';
	}
	$tmp = download_url( $src, 30 );
	if ( is_wp_error( $tmp ) ) {
		return '';
	}
	$name   = preg_replace( '/\D/', '', $id ) . '.jpg';
	$dest   = $dir['path'] . '/' . $name;
	$editor = wp_get_image_editor( $tmp );
	$ok     = false;
	if ( ! is_wp_error( $editor ) ) {
		$editor->resize( 900, 900, false );
		$editor->set_quality( 82 );
		$ok = ! is_wp_error( $editor->save( $dest, 'image/jpeg' ) );
	}
	if ( ! $ok ) {
		$ok = @copy( $tmp, $dest ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
	@unlink( $tmp ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	return $ok ? $name : '';
}

/**
 * Update the local copy of LFAR's posts. Runs hourly (WP-Cron) and from "Update now".
 *
 * @return true|WP_Error
 */
function lfar_ig_fetch( $dl_limit = LFAR_IG_DL_LIMIT ) {
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 120 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
	$token    = lfar_ig_token();
	$settings = lfar_ig_settings();
	$acct     = preg_replace( '/\D/', '', $settings['account_id'] );
	if ( '' === $token || '' === $acct ) {
		return new WP_Error( 'ig', 'Add the access token and Instagram account ID first.' );
	}

	$profile = lfar_ig_get( LFAR_IG_API . $acct . '?' . http_build_query( array( 'fields' => 'username', 'access_token' => $token ) ) );
	if ( is_wp_error( $profile ) ) {
		return lfar_ig_fail( $profile );
	}
	update_option( 'lfar_ig_username', sanitize_text_field( $profile['username'] ), false );

	$fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}';
	$url    = LFAR_IG_API . $acct . '/media?' . http_build_query( array( 'fields' => $fields, 'limit' => 50, 'access_token' => $token ) );
	$items  = array();
	for ( $i = 0; $i < LFAR_IG_PAGES && $url; $i++ ) {
		$page = lfar_ig_get( $url );
		if ( is_wp_error( $page ) ) {
			return lfar_ig_fail( $page );
		}
		$items = array_merge( $items, isset( $page['data'] ) ? $page['data'] : array() );
		$url   = isset( $page['paging']['next'] ) ? $page['paging']['next'] : '';
	}

	$old    = (array) get_option( 'lfar_ig_posts', array() );
	$posts  = array();
	$oldest = PHP_INT_MAX;
	foreach ( $items as $m ) {
		$id = preg_replace( '/\D/', '', $m['id'] );
		$ts = strtotime( $m['timestamp'] );
		$oldest       = min( $oldest, $ts );
		$posts[ $id ] = array(
			'id'        => $id,
			'caption'   => isset( $m['caption'] ) ? $m['caption'] : '',
			'type'      => $m['media_type'],
			'permalink' => esc_url_raw( $m['permalink'] ),
			'ts'        => $ts,
			'image'     => isset( $old[ $id ]['image'] ) ? $old[ $id ]['image'] : '',
			'src'       => lfar_ig_image_source( $m ),
		);
	}
	// Older posts outside today's window are kept (Happy Tails history); ones inside it that
	// Instagram no longer returns were deleted there, so they go here too.
	foreach ( $old as $id => $p ) {
		if ( ! isset( $posts[ $id ] ) && $p['ts'] < $oldest ) {
			$posts[ $id ] = $p;
		}
	}
	uasort(
		$posts,
		function ( $a, $b ) {
			return $b['ts'] <=> $a['ts'];
		}
	);
	$posts = array_slice( $posts, 0, LFAR_IG_KEEP, true );

	// Images: newest first, a limited number per run.
	$dir     = lfar_ig_upload_dir();
	$saved   = 0;
	$pending = 0;
	foreach ( $posts as $id => $p ) {
		if ( $p['image'] && file_exists( $dir['path'] . '/' . $p['image'] ) ) {
			continue;
		}
		$posts[ $id ]['image'] = '';
		if ( empty( $p['src'] ) ) {
			continue;
		}
		if ( $saved < $dl_limit ) {
			$posts[ $id ]['image'] = lfar_ig_save_image( $id, $p['src'] );
			$saved++;
		} else {
			$pending++;
		}
	}
	// Remove images of posts no longer kept, and drop the expiring source URLs of saved ones.
	foreach ( (array) glob( $dir['path'] . '/*.jpg' ) as $f ) {
		if ( $f && ! isset( $posts[ basename( $f, '.jpg' ) ] ) ) {
			@unlink( $f ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
	}
	foreach ( $posts as $id => $p ) {
		if ( $p['image'] ) {
			unset( $posts[ $id ]['src'] );
		}
	}

	update_option( 'lfar_ig_posts', $posts, false );
	if ( $pending && ! wp_next_scheduled( 'lfar_ig_cron_more' ) ) {
		wp_schedule_single_event( time() + 120, 'lfar_ig_cron_more' ); // Fetch the rest of the images soon, not in an hour.
	}
	update_option(
		'lfar_ig_status',
		array(
			'ok'      => time(),
			'error'   => '',
			'expired' => false,
			'count'   => count( $posts ),
		),
		false
	);
	return true;
}

/** Record a failed update (the saved posts stay on the site). */
function lfar_ig_fail( WP_Error $e ) {
	$st            = (array) get_option( 'lfar_ig_status', array() );
	$st['error']   = $e->get_error_message();
	$st['expired'] = 'ig190' === $e->get_error_code();
	$st['failed']  = time();
	update_option( 'lfar_ig_status', $st, false );
	return $e;
}

add_action(
	'lfar_ig_cron',
	function () {
		lfar_ig_fetch();
	}
);
add_action(
	'lfar_ig_cron_more',
	function () {
		lfar_ig_fetch();
	}
);

add_action(
	'init',
	function () {
		if ( '' !== lfar_ig_token() && ! wp_next_scheduled( 'lfar_ig_cron' ) ) {
			wp_schedule_event( time() + 60, 'hourly', 'lfar_ig_cron' );
		}
	}
);

add_action(
	'switch_theme',
	function () {
		wp_clear_scheduled_hook( 'lfar_ig_cron' );
		wp_clear_scheduled_hook( 'lfar_ig_cron_more' );
	}
);

/* -------------------------------------------------------------------------
 * Front end: swap the mockup samples for live posts
 * ---------------------------------------------------------------------- */

function lfar_ig_ig_icon() {
	return '<svg viewbox="0 0 24 24"><rect height="18" rx="5" width="18" x="3" y="3"></rect><circle cx="12" cy="12" r="4"></circle></svg>';
}

function lfar_ig_img_url( $p ) {
	$dir = lfar_ig_upload_dir();
	return $dir['url'] . '/' . $p['image'] . '?v=' . (int) $p['ts'];
}

/** One card in the About / Get Involved grid (same markup as the mockup cards). */
function lfar_ig_news_card( $p, $more ) {
	$tag = '';
	if ( $p['label'] ) {
		$tag = '<span class="tag' . ( $p['urgent'] ? ' urgent' : '' ) . '">' . esc_html( $p['label'] ) . '</span>';
	}
	$video = 'VIDEO' === $p['type'] ? ' (video)' : '';
	return '<article class="news-card' . ( $more ? ' more-post" hidden=""' : '" data-anim="fade-up"' ) . ">\n"
		. '<a class="thumb" href="' . esc_url( $p['permalink'] ) . '" target="_blank" rel="noopener">'
		. '<img alt="' . esc_attr( $p['parsed']['title'] . $video ) . '" loading="lazy" src="' . esc_url( lfar_ig_img_url( $p ) ) . '"/>'
		. $tag . '<span class="overlay-mask">View post</span></a>' . "\n"
		. '<div class="news-body">' . "\n"
		. '<div class="meta"><span>' . lfar_ig_ig_icon() . 'Instagram · ' . esc_html( wp_date( 'M j, Y', $p['ts'] ) ) . '</span></div>' . "\n"
		. '<h4>' . esc_html( $p['parsed']['title'] ) . '</h4>' . "\n"
		. ( $p['parsed']['text'] ? '<p>' . esc_html( $p['parsed']['text'] ) . '</p>' . "\n" : '' )
		. "</div>\n</article>\n";
}

/**
 * Visitor-facing date line. A range shows the start and the end, not the end alone.
 *
 * @param array $p Post with event_start, event_end, event_has_time.
 */
function lfar_ig_event_when_text( $p ) {
	$end   = (int) $p['event_end'];
	$start = ! empty( $p['event_start'] ) ? (int) $p['event_start'] : $end;
	$same  = wp_date( 'Ymd', $start ) === wp_date( 'Ymd', $end );
	$timed = ! empty( $p['event_has_time'] );
	if ( $timed && $same ) {
		$from = wp_date( 'g:i a', $start );
		$to   = wp_date( 'g:i a', $end );
		// A single clock time is the start. End-of-day is only how we know the event is over.
		$clock = ( 235959 === (int) wp_date( 'His', $end ) || $from === $to ) ? $from : $from . ' – ' . $to;
		return wp_date( 'l, F j, Y', $start ) . ' · ' . $clock;
	}
	if ( $timed ) {
		return wp_date( 'l, F j, Y · g:i a', $start ) . ' – ' . wp_date( 'l, F j, Y · g:i a', $end );
	}
	if ( ! $same ) {
		return wp_date( 'F j, Y', $start ) . ' – ' . wp_date( 'F j, Y', $end );
	}
	return wp_date( 'l, F j, Y', $start );
}

/**
 * One homepage column card, or one card on the Events page.
 *
 * @param array  $p      Post, or empty array for a column with nothing in it.
 * @param string $column event | update | urgent.
 * @param bool   $past    Past-events archive (date line, no "next" label).
 * @param bool   $is_next True only for the single next event. Later upcoming cards say "Event".
 */
function lfar_ig_column_card( $p, $column, $past = false, $is_next = true ) {
	$labels = array(
		'event'  => array( 'Next event', '' ),
		'update' => array( 'Update', 'update' ),
		'urgent' => array( 'Urgent need', 'urgent' ),
	);
	if ( $past ) {
		$labels['event'] = array( 'Past event', '' );
	} elseif ( 'event' === $column && ! $is_next ) {
		$labels['event'] = array( 'Event', '' );
	}
	$label = $labels[ $column ];
	$tag   = '<span class="tag' . ( $label[1] ? ' ' . $label[1] : '' ) . '">' . esc_html( $label[0] ) . '</span>';
	$clock = '<svg viewbox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
	$cal   = '<svg viewbox="0 0 24 24"><rect height="16" rx="2" width="18" x="3" y="5"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>';
	if ( ! $p ) {
		$empty = array(
			'event'  => array( 'No upcoming event', 'The next event stays in this column until it is over.' ),
			'update' => array( 'No update right now', 'A post tagged #update or #news shows here.' ),
			'urgent' => array( 'No urgent need right now', 'A post tagged #urgentneed shows here.' ),
		);
		return '<article class="news-card news-card-empty col-' . esc_attr( $column ) . '">' . "\n"
			. '<div class="thumb thumb-empty">' . $tag . '</div>' . "\n"
			. '<div class="news-body"><h4>' . esc_html( $empty[ $column ][0] ) . '</h4>'
			. '<p>' . esc_html( $empty[ $column ][1] ) . '</p></div></article>' . "\n";
	}
	$link = esc_url( $p['permalink'] );
	$when = '';
	if ( 'event' === $column && ! empty( $p['event_end'] ) ) {
		$when = '<span>' . $cal . esc_html( lfar_ig_event_when_text( $p ) ) . '</span>';
	}
	$posted = '<span>' . $clock . 'Posted ' . esc_html( wp_date( 'F j, Y', $p['ts'] ) ) . '</span>';
	$class  = 'news-card col-' . $column . ( ( 'event' === $column && ! $past && $is_next ) ? ' is-next' : '' );
	return '<article class="' . esc_attr( $class ) . '" data-anim="fade-up">' . "\n"
		. '<a class="thumb" href="' . $link . '" target="_blank" rel="noopener">' . $tag
		. '<img alt="' . esc_attr( $p['parsed']['title'] ) . '" loading="lazy" src="' . esc_url( lfar_ig_img_url( $p ) ) . '"/>'
		. '<span class="overlay-mask">View post</span></a>' . "\n"
		. '<div class="news-body">' . "\n"
		. '<div class="meta">' . $when . $posted . '</div>' . "\n"
		. '<h4>' . esc_html( $p['parsed']['title'] ) . '</h4>' . "\n"
		. ( $p['parsed']['text'] ? '<p>' . esc_html( $p['parsed']['text'] ) . '</p>' . "\n" : '' )
		. '<p class="lfar-a"><a class="more" href="' . $link . '" target="_blank" rel="noopener">View on Instagram <i>→</i></a></p>' . "\n"
		. "</div>\n</article>\n";
}

/** The three homepage columns, in order: event, update, urgent need. */
function lfar_ig_home_columns_html() {
	$cols = lfar_ig_home_columns();
	return lfar_ig_column_card( $cols['event'], 'event' )
		. lfar_ig_column_card( $cols['urgent'], 'urgent' )
		. lfar_ig_column_card( $cols['update'], 'update' );
}

/** Home's featured Happy Tail (replaces the "Success Story: Pepper" row). */
function lfar_ig_home_story( $p ) {
	$parsed = lfar_ig_parse_caption( $p['caption'], 420 );
	return '<div class="wp-block-group row"><div class="wp-block-group sec-image order-img" data-anim="fade-down">'
		. '<figure class="wp-block-image border-irregular">'
		. '<img src="' . esc_url( lfar_ig_img_url( $p ) ) . '" alt="' . esc_attr( $parsed['title'] ) . '" style="aspect-ratio:4/3;object-fit:cover"/></figure></div>' . "\n"
		. '<div class="wp-block-group custom" data-anim="slide-right">' . "\n"
		. '<h3 class="wp-block-heading">' . esc_html( $parsed['title'] ) . '</h3>' . "\n"
		. ( $parsed['text'] ? '<p>' . esc_html( $parsed['text'] ) . '</p>' . "\n" : '' )
		. '<p class="lfar-a"><a class="btn" href="/adopt/#stories">Read more Happy Tails</a></p>' . "\n"
		. "</div></div>\n";
}

/** One Happy Tails story on the Adopt page (same markup as the mockup). */
function lfar_ig_story( $p, $more ) {
	$label = $p['label'] ? $p['label'] : 'Happy tail';
	$icon  = '<svg aria-hidden="true" class="ig" viewbox="0 0 24 24"><rect height="18" rx="5" width="18" x="3" y="3"></rect><circle cx="12" cy="12" r="4.2"></circle><circle class="dot" cx="17.3" cy="6.7" r="1.1"></circle></svg>';
	return '<li class="story"' . ( $more ? ' hidden=""' : ' data-anim="fade-up"' ) . ">\n"
		. '<a class="thumb" href="' . esc_url( $p['permalink'] ) . '" target="_blank" rel="noopener"><span class="tag update">' . $icon . esc_html( $label ) . '</span>'
		. '<img alt="' . esc_attr( $p['parsed']['title'] ) . '" loading="lazy" src="' . esc_url( lfar_ig_img_url( $p ) ) . '"/><span class="overlay-mask">View on Instagram</span></a>' . "\n"
		. '<div class="story-body">' . "\n"
		. '<h4>' . esc_html( $p['parsed']['title'] ) . '</h4>' . "\n"
		. '<p class="story-meta">' . esc_html( wp_date( 'M j, Y', $p['ts'] ) ) . '</p>' . "\n"
		. ( $p['parsed']['text'] ? '<p>' . esc_html( $p['parsed']['text'] ) . '</p>' . "\n" : '' )
		. "</div>\n</li>\n";
}

function lfar_ig_empty_note() {
	return '<p class="feed-note lfar-ig-empty">New posts are on our <a href="' . esc_url( lfar_ig_profile_url() ) . '" target="_blank" rel="noopener">Instagram</a>.</p>';
}

add_filter(
	'render_block',
	function ( $html, $block ) {
		if ( is_admin() || ! lfar_ig_live() ) {
			return $html;
		}
		$page = lfar_page_key();
		if ( ! in_array( $page, array( 'home', 'about', 'get-involved', 'adopt', 'events' ), true ) ) {
			return $html;
		}
		$name  = isset( $block['blockName'] ) ? $block['blockName'] : '';
		$class = isset( $block['attrs']['className'] ) ? ' ' . $block['attrs']['className'] . ' ' : '';
		static $cache = array();
		foreach ( 'home' === $page ? array( 'home', 'adopt' ) : array( $page ) as $sec ) {
			if ( ! isset( $cache[ $sec ] ) ) {
				$cache[ $sec ] = lfar_ig_section_posts( $sec );
			}
		}
		$posts = $cache[ $page ];

		if ( 'home' === $page ) {
			// Three columns: next event, update, urgent need. Not the latest three posts.
			if ( 'core/group' === $name && false !== strpos( $class, ' news-grid ' ) ) {
				return '<div class="wp-block-group news-grid">' . "\n" . lfar_ig_home_columns_html() . '</div>';
			}
			// Featured Happy Tail.
			if ( 'core/group' === $name && false !== strpos( $class, ' row ' ) && false !== strpos( $html, 'Read more Happy Tails' ) && $cache['adopt'] ) {
				return lfar_ig_home_story( $cache['adopt'][0] );
			}
			return $html;
		}

		if ( 'events' === $page ) {
			$split = lfar_ig_events_split();
			if ( 'core/group' === $name && false !== strpos( $class, ' events-upcoming ' ) ) {
				$cards = '';
				foreach ( $split['upcoming'] as $i => $p ) {
					$cards .= lfar_ig_column_card( $p, 'event', false, 0 === $i );
				}
				if ( ! $cards ) {
					$cards = lfar_ig_column_card( array(), 'event' );
				}
				return '<div class="wp-block-group news-grid events-upcoming">' . "\n" . $cards . '</div>';
			}
			if ( 'core/group' === $name && false !== strpos( $class, ' events-past ' ) ) {
				$cards = '';
				foreach ( $split['past'] as $p ) {
					$cards .= lfar_ig_column_card( $p, 'event', true );
				}
				if ( ! $cards ) {
					return '<div class="wp-block-group news-grid events-past"></div><p class="feed-note">Past events will collect here.</p>';
				}
				return '<div class="wp-block-group news-grid events-past">' . "\n" . $cards . '</div>';
			}
			return $html;
		}

		// About / Get Involved: the card grid.
		if ( 'core/group' === $name && false !== strpos( $class, ' news-grid ' ) && false !== strpos( $html, 'id="feed-grid"' ) ) {
			if ( ! $posts ) {
				return '<div class="wp-block-group news-grid" id="feed-grid"></div>' . lfar_ig_empty_note();
			}
			$cards = '';
			foreach ( $posts as $i => $p ) {
				$cards .= lfar_ig_news_card( $p, $i >= 3 );
			}
			return '<div class="wp-block-group news-grid" id="feed-grid">' . "\n" . $cards . '</div>';
		}
		// The mockup's "Shows posts tagged…" note.
		if ( 'core/paragraph' === $name && false !== strpos( $class, ' feed-note ' ) ) {
			return '';
		}
		// "See more": only when there is more to see.
		if ( 'core/html' === $name && false !== strpos( $html, 'id="see-more"' ) && count( $posts ) <= 3 ) {
			return '';
		}
		// "Follow us on Instagram" buttons.
		if ( false !== strpos( $html, '>Follow us on Instagram<' ) ) {
			return str_replace( 'href="#">Follow us on Instagram<', 'href="' . esc_url( lfar_ig_profile_url() ) . '" target="_blank" rel="noopener">Follow us on Instagram<', $html );
		}
		// Adopt: Happy Tails.
		if ( 'core/html' === $name && false !== strpos( $html, '<ul class="stories">' ) ) {
			if ( ! $posts ) {
				return lfar_ig_empty_note();
			}
			$items = '';
			foreach ( $posts as $i => $p ) {
				$items .= lfar_ig_story( $p, $i >= 3 );
			}
			return '<ul class="stories" data-ig="' . esc_url( lfar_ig_profile_url() ) . '">' . "\n" . $items . "</ul>\n";
		}
		if ( 'core/html' === $name && false !== strpos( $html, 'id="tales-btn"' ) && count( $posts ) <= 3 ) {
			return '<a class="btn btn-ghost" href="' . esc_url( lfar_ig_profile_url() ) . '" target="_blank" rel="noopener">See more on Instagram</a>';
		}
		if ( 'core/paragraph' === $name && false !== strpos( $class, ' tales-note ' ) ) {
			return '';
		}
		return $html;
	},
	10,
	2
);

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( lfar_ig_live() && in_array( lfar_page_key(), array( 'about', 'adopt' ), true ) ) {
			wp_enqueue_script( 'lfar-instagram', get_theme_file_uri( 'assets/js/instagram.js' ), array( 'lfar-page' ), lfar_ver( 'assets/js/instagram.js' ), array( 'in_footer' => true ) );
		}
	},
	20
);

/* -------------------------------------------------------------------------
 * Settings → LFAR Instagram
 * ---------------------------------------------------------------------- */

add_action(
	'admin_menu',
	function () {
		add_options_page( 'LFAR Instagram', 'LFAR Instagram', 'manage_options', 'lfar-instagram', 'lfar_ig_admin_page' );
	}
);

add_action(
	'admin_post_lfar_ig_save',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'lfar_ig_save' );
		// phpcs:disable WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized field by field below.
		$in = wp_unslash( $_POST );
		// phpcs:enable

		$msg = 'saved';
		if ( ! defined( 'LFAR_IG_TOKEN' ) && ! empty( $in['token'] ) ) {
			$token = preg_replace( '/[^A-Za-z0-9]/', '', (string) $in['token'] );
			update_option( 'lfar_ig_token', $token, false );
		}
		if ( ! defined( 'LFAR_IG_TOKEN' ) && ! empty( $in['remove_token'] ) ) {
			delete_option( 'lfar_ig_token' );
			wp_clear_scheduled_hook( 'lfar_ig_cron' );
		}

		$d        = lfar_ig_default_settings();
		$settings = lfar_ig_settings();
		if ( isset( $in['account_id'] ) ) {
			$settings['account_id'] = preg_replace( '/\D/', '', (string) $in['account_id'] );
		}
		foreach ( array( 'event_tags', 'update_tags', 'urgent_tags' ) as $tag_key ) {
			if ( isset( $in[ $tag_key ] ) ) {
				$settings[ $tag_key ] = implode( ' ', lfar_ig_tag_list( $in[ $tag_key ] ) );
			}
		}
		if ( isset( $in['urgent_days'] ) ) {
			$settings['urgent_days'] = max( 1, min( 365, (int) $in['urgent_days'] ) );
		}
		foreach ( array_keys( $d['sections'] ) as $k ) {
			if ( empty( $in['sections'][ $k ] ) || ! is_array( $in['sections'][ $k ] ) ) {
				continue;
			}
			$s = $in['sections'][ $k ];
			$settings['sections'][ $k ]['site']     = implode( ' ', lfar_ig_tag_list( isset( $s['site'] ) ? $s['site'] : '' ) );
			$settings['sections'][ $k ]['fallback'] = implode( ' ', lfar_ig_tag_list( isset( $s['fallback'] ) ? $s['fallback'] : '' ) );
			$settings['sections'][ $k ]['phrases']  = empty( $s['phrases'] ) ? 0 : 1;
			$settings['sections'][ $k ]['max']      = max( 1, min( 30, isset( $s['max'] ) ? (int) $s['max'] : $d['sections'][ $k ]['max'] ) );
		}
		if ( ! empty( $in['reset_sections'] ) ) {
			$settings['sections']    = $d['sections'];
			$settings['event_tags']  = $d['event_tags'];
			$settings['update_tags'] = $d['update_tags'];
			$settings['urgent_tags'] = $d['urgent_tags'];
			$settings['urgent_days'] = $d['urgent_days'];
		}
		update_option( 'lfar_ig_settings', $settings, false );

		if ( isset( $in['shown'] ) && is_array( $in['shown'] ) ) {
			$hidden = (array) get_option( 'lfar_ig_hidden', array() );
			$listed = array_map( 'strval', array_map( 'absint', $in['shown'] ) );
			$hide   = isset( $in['hide'] ) && is_array( $in['hide'] ) ? array_map( 'strval', array_map( 'absint', $in['hide'] ) ) : array();
			$hidden = array_values( array_unique( array_merge( array_diff( $hidden, $listed ), $hide ) ) );
			update_option( 'lfar_ig_hidden', $hidden, false );
		}

		if ( ! empty( $in['fetch_now'] ) || ( ! empty( $in['token'] ) && ! defined( 'LFAR_IG_TOKEN' ) ) ) {
			$r   = lfar_ig_fetch( 30 );
			$msg = is_wp_error( $r ) ? 'fetch_failed' : 'fetched';
		}
		wp_safe_redirect( add_query_arg( array( 'page' => 'lfar-instagram', 'lfar_ig' => $msg ), admin_url( 'options-general.php' ) ) );
		exit;
	}
);

/** Warn admins on every screen when the feed has stopped updating. */
add_action(
	'admin_notices',
	function () {
		if ( ! current_user_can( 'manage_options' ) || '' === lfar_ig_token() ) {
			return;
		}
		$st = (array) get_option( 'lfar_ig_status', array() );
		if ( empty( $st['error'] ) ) {
			return;
		}
		$link = admin_url( 'options-general.php?page=lfar-instagram' );
		$what = ! empty( $st['expired'] )
			? 'The Instagram connection has stopped working (the access token is no longer valid), so the site is showing the last posts it saved. Make a new Page token and paste it in'
			: 'The Instagram feed couldn\'t update: ' . esc_html( $st['error'] ) . '. The site is showing the last posts it saved. Details are';
		echo '<div class="notice notice-warning"><p><strong>LFAR Instagram:</strong> ' . $what . ' at <a href="' . esc_url( $link ) . '">Settings → LFAR Instagram</a>.</p></div>'; // phpcs:ignore WordPress.Security.EscapeOutput
	}
);

function lfar_ig_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$settings = lfar_ig_settings();
	$token    = lfar_ig_token();
	$st       = (array) get_option( 'lfar_ig_status', array() );
	$posts    = (array) get_option( 'lfar_ig_posts', array() );
	$hidden   = array_flip( (array) get_option( 'lfar_ig_hidden', array() ) );
	$user     = get_option( 'lfar_ig_username', '' );
	$labels   = lfar_ig_section_labels();
	$notice   = isset( $_GET['lfar_ig'] ) ? sanitize_key( $_GET['lfar_ig'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	// Where each post currently lands.
	$where = array();
	$cols  = lfar_ig_home_columns();
	foreach ( array( 'event' => 'Home: next event', 'update' => 'Home: update', 'urgent' => 'Home: urgent need' ) as $col => $label ) {
		if ( ! empty( $cols[ $col ] ) ) {
			$where[ $cols[ $col ]['id'] ][] = $label;
		}
	}
	$split = lfar_ig_events_split();
	foreach ( $split['upcoming'] as $p ) {
		$where[ $p['id'] ][] = 'Events: upcoming';
	}
	foreach ( $split['past'] as $p ) {
		$where[ $p['id'] ][] = 'Events: past';
	}
	foreach ( array_keys( $settings['sections'] ) as $k ) {
		foreach ( lfar_ig_section_posts( $k ) as $p ) {
			$where[ $p['id'] ][] = array( 'about' => 'About', 'get-involved' => 'Get Involved', 'adopt' => 'Happy Tails' )[ $k ];
		}
	}
	$dir = lfar_ig_upload_dir();
	?>
	<div class="wrap">
		<h1>LFAR Instagram</h1>
		<?php if ( 'fetched' === $notice ) : ?>
			<div class="notice notice-success"><p>Updated from Instagram.</p></div>
		<?php elseif ( 'fetch_failed' === $notice ) : ?>
			<div class="notice notice-error"><p>Saved, but the update from Instagram failed: <?php echo esc_html( isset( $st['error'] ) ? $st['error'] : '' ); ?></p></div>
		<?php elseif ( 'saved' === $notice ) : ?>
			<div class="notice notice-success"><p>Saved.</p></div>
		<?php endif; ?>

		<p>The site reads LFAR's own Instagram posts every hour. The homepage keeps three columns — the next <code>#event</code> (until that event is over), the newest <code>#update</code>, and the newest urgent need — and the Events page lists upcoming and past events. About, Get Involved and Adopt keep their own tag lists.
		Nothing is ever posted to Instagram from here.</p>

		<h2>Status</h2>
		<p>
		<?php
		if ( '' === $token ) {
			echo 'Not connected yet. Paste the Page access token below.';
		} else {
			echo $user ? 'Connected to <strong>@' . esc_html( $user ) . '</strong>. ' : 'Token saved. ';
			if ( ! empty( $st['ok'] ) ) {
				echo 'Last updated ' . esc_html( human_time_diff( $st['ok'] ) ) . ' ago; ' . (int) count( $posts ) . ' posts saved. ';
			}
			$next = wp_next_scheduled( 'lfar_ig_cron' );
			if ( $next ) {
				echo 'Next update in about ' . esc_html( human_time_diff( $next ) ) . '.';
			}
			if ( ! empty( $st['error'] ) ) {
				echo '<br><span style="color:#b32d2e"><strong>Last update failed:</strong> ' . esc_html( $st['error'] ) . '</span>';
			}
		}
		?>
		</p>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="lfar_ig_save">
			<?php wp_nonce_field( 'lfar_ig_save' ); ?>

			<h2>Connection</h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="lfar-ig-token">Page access token</label></th>
					<td>
						<?php if ( defined( 'LFAR_IG_TOKEN' ) ) : ?>
							<p>Set in <code>wp-config.php</code> (LFAR_IG_TOKEN).</p>
						<?php else : ?>
							<input type="password" id="lfar-ig-token" name="token" class="large-text" autocomplete="off" spellcheck="false"
								placeholder="<?php echo $token ? esc_attr( 'Saved (ends …' . substr( $token, -4 ) . '). Paste a new one to replace it.' ) : 'Paste the Page token here'; ?>">
							<p class="description">The Facebook Page token from Graph API Explorer (it should say "Expires: Never" in the Access Token Tool).
							It's never shown again after saving. Saving a new token updates the feed straight away.</p>
							<?php if ( $token ) : ?>
								<label><input type="checkbox" name="remove_token" value="1"> Disconnect (remove the saved token)</label>
							<?php endif; ?>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="lfar-ig-acct">Instagram account ID</label></th>
					<td><input type="text" id="lfar-ig-acct" name="account_id" value="<?php echo esc_attr( $settings['account_id'] ); ?>" class="regular-text">
					<p class="description">LFAR's Instagram business account. Leave as is.</p></td>
				</tr>
			</table>

			<h2>Homepage columns and the Events page</h2>
			<p>Tags are written without <code>#</code>, separated by spaces; capitalization doesn't matter.
			The homepage does not fill a column with whatever was posted last. Each column takes the newest post with its tag.
			An <strong>event</strong> stays in its column until the date written in the caption has passed
			(<code>October 3, 2026</code>, <code>Oct 3–5, 2026</code>, <code>11 am – 2 pm</code>, <code>10/3/2026</code>).
			If the caption has no date, that post stays until a newer event post replaces it, then it moves to the past archive.
			Put the event date in the caption or the column cannot tell when the event is over.</p>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">Event column and Events page</th>
					<td><input type="text" class="large-text" name="event_tags" value="<?php echo esc_attr( $settings['event_tags'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row">Update column</th>
					<td><input type="text" class="large-text" name="update_tags" value="<?php echo esc_attr( $settings['update_tags'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row">Urgent-need column</th>
					<td>
						<p><label>Posts with these tags<br><input type="text" class="large-text" name="urgent_tags" value="<?php echo esc_attr( $settings['urgent_tags'] ); ?>"></label></p>
						<p><label>are taken out of the column after <input type="number" min="1" max="365" class="small-text" name="urgent_days" value="<?php echo (int) $settings['urgent_days']; ?>"> days.</label></p>
					</td>
				</tr>
			</table>

			<h2>Which posts go where</h2>
			<p><strong>Site tags</strong> are the ones Melody adds on purpose. Those posts come first, newest first.
			<strong>Also show</strong> fills the remaining spots, newest first: posts with any of those tags
			(<code>*</code> means any post).</p>
			<table class="form-table" role="presentation">
				<?php foreach ( $settings['sections'] as $k => $sec ) : ?>
				<tr>
					<th scope="row"><?php echo $labels[ $k ]; // phpcs:ignore WordPress.Security.EscapeOutput ?></th>
					<td>
						<p><label>Site tags<br><input type="text" class="large-text" name="sections[<?php echo esc_attr( $k ); ?>][site]" value="<?php echo esc_attr( $sec['site'] ); ?>"></label></p>
						<p><label>Also show<br><input type="text" class="large-text" name="sections[<?php echo esc_attr( $k ); ?>][fallback]" value="<?php echo esc_attr( $sec['fallback'] ); ?>"></label></p>
						<?php if ( 'adopt' === $k ) : ?>
						<p><label><input type="checkbox" name="sections[adopt][phrases]" value="1" <?php checked( ! empty( $sec['phrases'] ) ); ?>>
						Also show adoption announcements without a tag ("found his furever home", "got adopted"…)</label></p>
						<?php else : ?>
						<input type="hidden" name="sections[<?php echo esc_attr( $k ); ?>][phrases]" value="0">
						<?php endif; ?>
						<p><label>Show up to <input type="number" min="1" max="30" class="small-text" name="sections[<?php echo esc_attr( $k ); ?>][max]" value="<?php echo (int) $sec['max']; ?>"> posts</label>
						(3 at first, the rest behind the "See more" button)</p>
					</td>
				</tr>
				<?php endforeach; ?>
			</table>
			<p><label><input type="checkbox" name="reset_sections" value="1"> Reset the tag lists above to the theme's defaults</label></p>

			<?php if ( $posts ) : ?>
			<h2>Saved posts</h2>
			<p>Tick <strong>Hide</strong> to keep a post off the site.</p>
			<table class="widefat striped" style="max-width:1100px">
				<thead><tr><th style="width:60px">Hide</th><th style="width:70px"></th><th>Post</th><th style="width:160px">Shows on</th></tr></thead>
				<tbody>
				<?php
				foreach ( array_slice( $posts, 0, 60, true ) as $p ) :
					$parsed = lfar_ig_parse_caption( $p['caption'] );
					?>
					<tr>
						<td><input type="hidden" name="shown[]" value="<?php echo esc_attr( $p['id'] ); ?>">
							<input type="checkbox" name="hide[]" value="<?php echo esc_attr( $p['id'] ); ?>" <?php checked( isset( $hidden[ $p['id'] ] ) ); ?>></td>
						<td><?php if ( $p['image'] ) : ?><img src="<?php echo esc_url( $dir['url'] . '/' . $p['image'] ); ?>" alt="" style="width:60px;height:60px;object-fit:cover"><?php endif; ?></td>
						<td><a href="<?php echo esc_url( $p['permalink'] ); ?>" target="_blank" rel="noopener"><strong><?php echo esc_html( $parsed['title'] ); ?></strong></a>
							<br><small><?php echo esc_html( wp_date( 'M j, Y', $p['ts'] ) ); ?> · <?php echo esc_html( implode( ' ', array_map( function ( $t ) { return '#' . $t; }, lfar_ig_hashtags( $p['caption'] ) ) ) ); ?></small></td>
						<td>
						<?php
						if ( isset( $hidden[ $p['id'] ] ) ) {
							echo '<em>Hidden</em>';
						} elseif ( ! $p['image'] ) {
							echo '<em>Image still downloading</em>';
						} else {
							echo esc_html( isset( $where[ $p['id'] ] ) ? implode( ', ', $where[ $p['id'] ] ) : '—' );
						}
						?>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<?php endif; ?>

			<p class="submit">
				<?php submit_button( 'Save', 'primary', 'save', false ); ?>
				<?php if ( $token ) : ?>
					&nbsp;<?php submit_button( 'Save and update from Instagram now', 'secondary', 'fetch_now', false ); ?>
				<?php endif; ?>
			</p>
		</form>
	</div>
	<?php
}
