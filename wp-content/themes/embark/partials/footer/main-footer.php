<div class="footer-wrapper">
	<footer class="main-footer element-padding-top">
		<div class="container">
			<div class="row">
				<div class="col-12 col-md">
					<h3 class="main-footer__title">Head Office</h3><!-- /.main-footer__title -->
					<address class="main-footer__address element-small-margin-top">
						<p><?php the_field( 'address', 'options' ); ?></p>
					</address><!-- /.main-footer__address element-small-margin-top -->
				</div><!-- /.col-12 col-md -->
				<div class="col-12 col-md">
					<h3 class="main-footer__title element-margin-top mt-md-0">Paylink Products</h3><!-- /.main-footer__title element-margin-top mt-md-0 -->

					<?php
					    wp_nav_menu([
					        'menu'            => 'Footer Navigation - left column',
					        'theme_location'  => 'footer_navigation_left_column'
					    ]);
					?>

				</div><!-- /.col-12 col-md -->
				<div class="col-12 col-md">
					<h3 class="main-footer__title element-margin-top mt-md-0">Sector Solutions</h3><!-- /.main-footer__title element-margin-top mt-md-0 -->

					<?php
					    wp_nav_menu([
					        'menu'            => 'Footer Navigation - right column',
					        'theme_location'  => 'footer_navigation_right_column'
					    ]);
					?>

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
						<span class="second-stage__description"><?php the_field( 'footer_privacy_policy', 'options' ); ?></span>
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