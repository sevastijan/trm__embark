<div class="footer-wrapper">
	<footer class="main-footer element-padding-top">
		<div class="container">
			<div class="row">
				<div class="col-12 col-md">
					<h3 class="main-footer__title">Head Office</h3><!-- /.main-footer__title -->
					<address class="main-footer__address element-small-margin-top">
						<p>Kempton House, Kempton Way,<br>PO Box 9562<br>Grantham, Lincolnshire, NG31 0EA</p>
					</address><!-- /.main-footer__address element-small-margin-top -->
				</div><!-- /.col-12 col-md -->
				<div class="col-12 col-md">
					<h3 class="main-footer__title element-margin-top mt-md-0">Paylink Products</h3><!-- /.main-footer__title element-margin-top mt-md-0 -->
					<ul class="main-footer__nav list-unstyled element-small-margin-top">
						<li class="nav-item">
							<a href="#" class="nav-link">Paylink Embark</a>
						</li>
						<li class="nav-item">
							<a href="#" class="nav-link">Paylink CPQ</a>
						</li>
						<li class="nav-item">
							<a href="#" class="nav-link">Paylink Platform</a>
						</li>
					</ul><!-- /.main-footer__nav list-unstyled element-small-margin-top -->
				</div><!-- /.col-12 col-md -->
				<div class="col-12 col-md">
					<h3 class="main-footer__title element-margin-top mt-md-0">Sector Solutions</h3><!-- /.main-footer__title element-margin-top mt-md-0 -->
					<ul class="main-footer__nav list-unstyled element-small-margin-top">
						<li class="nav-item">
							<a href="#" class="nav-link">Banking</a>
						</li>
						<li class="nav-item">
							<a href="#" class="nav-link">Insurance</a>
						</li>
						<li class="nav-item">
							<a href="#" class="nav-link">Lending</a>
						</li>
						<li class="nav-item">
							<a href="#" class="nav-link">Debt</a>
						</li>
					</ul><!-- /.main-footer__nav list-unstyled element-small-margin-top -->
				</div><!-- /.col-12 col-md -->
				<div class="col-lg-5">
					<h3 class="main-footer__title element-margin-top mt-lg-0">Subscribe to latest news</h3><!-- /.main-footer__title element-margin-top mt-lg-0 -->
					<form action="<?= esc_url( home_url( '/' ) ); ?>" class="main-footer__form element-small-margin-top">
						<input type="text" required placeholder="Your e-mail address" />
						<button type="submit"><i class="fal fa-paper-plane"></i> Sign Up</button>
					</form><!-- /.main-footer__form element-small-margin-top -->
					<span class="main-footer__description d-block element-small-margin-top">Latest news and promotions delivered to your inbox!</span>
				</div><!-- /.col-lg-5 -->
			</div><!-- /.row -->
		</div><!-- /.container -->
		<div class="second-stage text-center element-paddings element-margin-top">
			<div class="container">
				<div class="row">
					<div class="col-12">
						<span class="second-stage__description">Paylink is a trading name of Paylink Solutions Limited. Paylink Solutions Limited is a limited company registered in England with registered number:10318423. Registered address: Kempton House, Kempton Way, PO Box 9562, Grantham, Lincolnshire, NG31 0EA.</span>
					</div><!-- /.col-12 -->
					<div class="col-12">
						<?php
						    wp_nav_menu([
						        'menu'            => 'Footer Navigation',
						        'theme_location'  => 'footer_navigation'
						    ]);
						?>
					</div><!-- /.col-12 -->
				</div><!-- /.row -->
			</div><!-- /.container -->
		</div><!-- /.second-stage text-center element-paddings element-margin-top -->
	</footer><!-- /.main-footer element-padding-top -->
</div><!-- /.footer-wrapper -->

<!-- <img data-src="<?php //echo get_template_directory_uri(); ?>/images/logo__XXX.svg" src="<?php //echo get_template_directory_uri(); ?>/images/img__empty.png" alt="<?php //echo get_bloginfo('name'); ?>" class="navbar-brand__logo lazy" />-->