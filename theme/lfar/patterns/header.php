<?php
/**
 * Title: Site header
 * Slug: lfar/header
 * Categories: lfar-chrome
 * Inserter: no
 */
?>
<!-- wp:html -->
<div class="topbar">
  <div class="container">
    <ul>
      <li class="pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>Los Feliz Animal Rescue</li>
      <li class="hl hide-sm">501(c)(3) Nonprofit</li>
      <li class="hl hide-sm">EIN 87-4677140</li>
    </ul>
    <ul class="social">
      <li><a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg></a></li>
      <li><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm6-7.9a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 18 7.1zM21.9 8.2a5.4 5.4 0 0 0-1.5-3.9 5.4 5.4 0 0 0-3.9-1.5C15 2.7 9 2.7 7.5 2.8a5.4 5.4 0 0 0-3.9 1.5 5.4 5.4 0 0 0-1.5 3.9C2 9.7 2 14.3 2.1 15.8a5.4 5.4 0 0 0 1.5 3.9 5.4 5.4 0 0 0 3.9 1.5c1.5.1 7.5.1 9 0a5.4 5.4 0 0 0 3.9-1.5 5.4 5.4 0 0 0 1.5-3.9c.1-1.5.1-6.1 0-7.6zM19.9 18a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-6.2.4s-5 .1-6.2-.4A3 3 0 0 1 4.1 18c-.5-1.2-.4-4-.4-6s-.1-4.8.4-6.1a3 3 0 0 1 1.7-1.7C7 3.8 9.8 3.9 12 3.9s5-.1 6.2.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4 .4 6.1s.1 4.8-.4 5.9z"/></svg></a></li>
      <li><a href="#" aria-label="Email"><svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.2V17h16V7.2l-8 5.3zM5.6 7l6.4 4.2L18.4 7z"/></svg></a></li>
    </ul>
  </div>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<nav class="navbar" id="navbar" aria-label="Main">
  <div class="nav-inner">
    <a class="brand" href="/" aria-label="Los Feliz Animal Rescue home">
      <img class="icon" src="<?php echo esc_url( get_theme_file_uri( 'assets/images/lfar-paw-icon.png' ) ); ?>" alt="">
      <img class="word" src="<?php echo esc_url( get_theme_file_uri( 'assets/images/lfar-wordmark.png' ) ); ?>" alt="Los Feliz Animal Rescue">
    </a>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
    <ul class="menu" id="menu">
      <li><a href="/">Home</a></li>
      <li><a href="/adopt/">Adopt</a></li>
      <li><a href="/get-involved/">Get Involved</a></li>
      <li><a href="/about/">About</a></li>
      <li><a href="/contact/">Contact</a></li>
      <li class="nav-donate"><a href="/donate/">Donate</a></li>
    </ul>
  </div>
</nav>
<!-- /wp:html -->
