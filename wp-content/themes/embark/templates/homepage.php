<?php
    /*
    	Template Name: Homepage
    *
    *   @package Crunch
    *   @since Crunch 2.0.0
    */
?>

<?php get_header(); ?>

<main id="main" class="homepage-template">

	<section class="intro element-paddings">
		<div class="container">
			<div class="row justify-content-between">
				<div class="col-lg-6">
					<div class="intro__title-wrapper">
						<h1 class="intro__title"><?php the_title(); ?></h1><!-- /.intro__title -->
					</div><!-- /.intro__title-wrapper -->
					<div class="intro__content content element-small-margin-top">
						<?php the_content(); ?>
					</div><!-- /.intro__content content element-small-margin-top -->
				</div><!-- /.col-lg-6 -->
				<div class="col-lg-6 text-center">

					<?php if( have_rows('action_button') ): ?>
						<?php while( have_rows('action_button') ): the_row();  ?>

							<a href="<?php the_sub_field( 'link' ); ?>" class="embark-button embark-button__full-background embark-button__full-background--secondary-color element-margin-top mt-lg-0"><?php the_sub_field( 'label' ); ?></a>

						<?php endwhile; ?>
					<?php endif; ?>

					<div class="video element-small-margin-top">
						<div class="video__bar text-left">
							<span class="circle"></span>
							<span class="circle"></span>
							<span class="circle"></span>
						</div><!-- /.video__bar text-left -->

						<?php $placeholder = get_field( 'intro_video_placeholder' ); ?>
						<?php if($placeholder): ?>

							<?php $iframe = get_field('intro_video'); ?>
							<?php preg_match('/src="(.+?)"/', $iframe, $matches); ?>
							<?php $src = $matches[1]; ?>

							<div class="video__placeholder background-cover lazy" data-src="<?= $placeholder['url']; ?>"><span class="video__play-button" data-vimeo-src="<?= $src; ?>"></span></div><!-- /.video__placeholder background-cover lazy -->

						<?php else: ?>

							<?php the_field('intro_video'); ?>

						<?php endif; ?>

					</div><!-- /.video element-small-margin-top -->
				</div><!-- /.col-lg-6 text-center -->
			</div><!-- /.row justify-content-between -->
		</div><!-- /.container -->
	</section><!-- /.intro element-paddings -->

	<section id="about" class="about-what element-padding-bottom">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-what__title"><?php the_field( 'what_title' ); ?></h2><!-- /.about-what__title -->
					<div class="about-what__content content element-small-margin-top">
						<?php the_field( 'what_content' ); ?>
					</div><!-- /.about-what__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-what element-padding-bottom -->

	<section class="about-why element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-why__title"><?php the_field( 'why_title' ); ?></h2><!-- /.about-why__title -->
					<div class="about-why__content content element-small-margin-top">
						<?php the_field( 'why_content' ); ?>
					</div><!-- /.about-why__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-why element-paddings -->

	<section class="about-how element-padding-top">
		<div class="container">
			<div class="row">
				<div class="col-md-10 col-lg-9 mx-auto">
					<h2 class="about-how__title text-center"><?php the_field( 'how_title' ); ?></h2><!-- /.about-how__title text-center -->
					<div class="about-how__content content element-small-margin-top">
						<?php the_field( 'how_content' ); ?>
					</div><!-- /.about-how__content content element-small-margin-top -->
				</div><!-- /.col-md-10 col-lg-9 mx-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-how element-padding-top -->

	<section class="customer-area element-padding-top">
		<div class="container">
			<div class="row justify-content-between">
				<div class="col-md-6 text-auto col-xl-auto">
					<section class="single-customer-area text-center">

						<?php $icon = get_field( 'for_who_icon_1' ); ?>
						<?php if($icon): ?>

							<div class="single-customer-area__icon-wrapper">
								<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-customer-area__icon svg" />
							</div><!-- /.single-customer-area__icon-wrapper -->

						<?php endif; ?>

						<h2 class="single-customer-area__title element-extra-small-margin-top"><?php the_field( 'for_who_title_1' ); ?></h2><!-- /.single-customer-area__title element-extra-small-margin-top -->
						<div class="single-customer-area__content content element-small-margin-top" data-mh="single-customer-area-match-height">
							<?php the_field( 'for_who_content_1' ); ?>
						</div><!-- /.single-customer-area__content content element-small-margin-top -->

						<?php if ( have_rows( 'for_who_accordion_1' ) ) : ?>

							<div class="single-customer-area__accordion accordion text-left element-medium-margin-top" id="accordion-1">

								<?php $loop_counter = 1; ?>
								<?php while ( have_rows( 'for_who_accordion_1' ) ) : the_row(); ?>

									<div class="card">
										<div class="card-header" id="heading_one_<?= $loop_counter; ?>">
											<button class="card-header__button<?php if($loop_counter > 1) echo ' collapsed'; ?>" type="button" data-toggle="collapse" data-target="#collapse_one_<?= $loop_counter; ?>" aria-expanded="<?php if($loop_counter == 1) {echo 'true';} else {echo 'false';} ?>" aria-controls="collapse_one_<?= $loop_counter; ?>"><?php the_sub_field( 'label' ); ?></button>
										</div><!-- /#heading_one_1.card-header -->
										<div id="collapse_one_<?= $loop_counter; ?>" class="collapse<?php if($loop_counter == 1) echo ' show'; ?> accordion__collapse" aria-labelledby="heading_one_<?= $loop_counter; ?>" data-parent="#accordion-1">
											<div class="card-body content">
												<?php the_sub_field( 'content' ); ?>
											</div><!-- /.card-body content -->
										</div><!-- /#collapse_one_1.collapse show -->
									</div><!-- /.card -->

									<?php $loop_counter++; ?>
								<?php endwhile; ?>

							</div><!-- /#accordion-1.single-customer-area__accordion accordion text-left element-medium-margin-top -->

						<?php endif; ?>

					</section><!-- /.single-customer-area text-center -->
				</div><!-- /.col-md-6 text-auto col-xl-auto -->
				<div class="col-md-6 text-auto col-xl-auto">
					<section class="single-customer-area element-margin-top mt-md-0 text-center">

						<?php $icon = get_field( 'for_who_icon_2' ); ?>
						<?php if($icon): ?>

							<div class="single-customer-area__icon-wrapper">
								<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-customer-area__icon svg" />
							</div><!-- /.single-customer-area__icon-wrapper -->

						<?php endif; ?>

						<h2 class="single-customer-area__title element-extra-small-margin-top"><?php the_field( 'for_who_title_2' ); ?></h2><!-- /.single-customer-area__title element-extra-small-margin-top -->
						<div class="single-customer-area__content content element-small-margin-top" data-mh="single-customer-area-match-height">
							<?php the_field( 'for_who_content_2' ); ?>
						</div><!-- /.single-customer-area__content content element-small-margin-top -->

						<?php if ( have_rows( 'for_who_accordion_1' ) ) : ?>

							<div class="single-customer-area__accordion accordion text-left element-medium-margin-top" id="accordion-2">

								<?php $loop_counter = 1; ?>
								<?php while ( have_rows( 'for_who_accordion_1' ) ) : the_row(); ?>

									<div class="card">
										<div class="card-header" id="heading_two_<?= $loop_counter; ?>">
											<button class="card-header__button<?php if($loop_counter > 1) echo ' collapsed'; ?>" type="button" data-toggle="collapse" data-target="#collapse_two_<?= $loop_counter; ?>" aria-expanded="<?php if($loop_counter == 1) {echo 'true';} else {echo 'false';} ?>" aria-controls="collapse_two_<?= $loop_counter; ?>"><?php the_sub_field( 'label' ); ?></button>
										</div><!-- /#heading_two_1.card-header -->
										<div id="collapse_two_<?= $loop_counter; ?>" class="collapse<?php if($loop_counter == 1) echo ' show'; ?> accordion__collapse" aria-labelledby="heading_two_<?= $loop_counter; ?>" data-parent="#accordion-2">
											<div class="card-body content">
												<?php the_sub_field( 'content' ); ?>
											</div><!-- /.card-body content -->
										</div><!-- /#collapse_one_1.collapse show -->
									</div><!-- /.card -->

									<?php $loop_counter++; ?>
								<?php endwhile; ?>

							</div><!-- /#accordion-2.single-customer-area__accordion accordion text-left element-medium-margin-top -->

						<?php endif; ?>

					</section><!-- /.single-customer-area element-margin-top mt-md-0 text-center -->
				</div><!-- /.col-md-6 text-auto col-xl-auto -->
			</div><!-- /.row justify-content-between -->
		</div><!-- /.container -->
	</section><!-- /.customer-area element-padding-top -->

	<section id="features" class="features element-paddings element-margin-top">
		<div class="container">
			<div class="row">
				<div class="col-md-6">
					<div class="row no-gutters">

						<?php $icon = get_field( 'key_facts_icon' ); ?>
						<?php if($icon): ?>

							<div class="col col-auto">
								<div class="features__icon-wrapper">
									<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="features__icon svg" />
								</div><!-- /.features__icon-wrapper -->
							</div><!-- /.col col-auto -->

						<?php endif; ?>

						<div class="col">
							<h2 class="features__title"><?php the_field( 'key_facts_title' ); ?></h2><!-- /.features__title -->
						</div><!-- /.col -->
						<div class="col-12">
							<div class="features__content content element-extra-small-margin-top">
								<?php the_field( 'key_facts_content' ); ?>
							</div><!-- /.features__content content element-extra-small-margin-top -->
						</div><!-- /.col-12 -->
					</div><!-- /.row no-gutters -->
				</div><!-- /.col-md-6 -->
			</div><!-- /.row -->

			<div class="row">
				<div class="col-md-6">

					<?php $image = get_field( 'key_facts_image' ); ?>
					<?php if($image): ?>

						<img src="<?= $image['url']; ?>" alt="<?= $image['alt']; ?>" class="features__image element-margin-top w-100 d-md-none" />

						<svg id="Warstwa_1" class="features__image element-margin-top d-none d-md-block" data-name="Warstwa 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1351.92 833.76">
							<defs>
								<style>.cls-1{fill:#fff;}</style>
							</defs>
							<title>laptop</title>

							<image width="5633" height="4224" transform="translate(0 -180) scale(0.24)" xlink:href="<?php echo get_template_directory_uri(); ?>/images/img__laptop.png"/>
							<image id="image-em" x="228" y="40" width="918" height="571" xlink:href="<?= $image['url']; ?>"></image>
						</svg>

					<?php endif; ?>

					<div class="impression element-margin-top d-none d-md-block">
						<div class="impression__title-wrapper">
							<h3 class="impression__title"><?php the_field( 'impression_title' ); ?></h3><!-- /.impression__title -->
						</div><!-- /.impression__title-wrapper -->
						<div class="impression__content content element-extra-small-margin-top">
							<?php the_field( 'impression_content' ); ?>
						</div><!-- /.impression__content content element-extra-small-margin-top -->
					</div><!-- /.impression element-margin-top d-none d-md-block -->

				</div><!-- /.col-md-6 -->
				<div class="col-md-6">

					<?php if ( have_rows( 'key_facts' ) ) : ?>
						<?php while ( have_rows( 'key_facts' ) ) : the_row(); ?>

							<div class="single-feature element-medium-margin-top">
								<div class="row no-gutters">

									<?php $icon = get_sub_field( 'icon' ); ?>
									<?php if($icon): ?>

										<div class="col col-auto">
											<div class="single-feature__icon-wrapper">
												<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-feature__icon svg" />
											</div><!-- /.single-feature__icon-wrapper -->
										</div><!-- /.col col-auto -->

									<?php endif; ?>

									<div class="col">
										<h3 class="single-feature__title"><?php the_sub_field( 'title' ); ?></h3><!-- /.single-feature__title -->
										<div class="single-feature__content content element-extra-small-margin-top">
											<?php the_sub_field( 'content' ); ?>
										</div><!-- /.single-feature__content content element-extra-small-margin-top -->
									</div><!-- /.col -->
								</div><!-- /.row no-gutters -->
							</div><!-- /.single-feature element-medium-margin-top -->

						<?php endwhile; ?>
					<?php endif; ?>

					<div class="impression element-margin-top d-md-none">
						<div class="impression__title-wrapper">
							<h3 class="impression__title"><?php the_field( 'impression_title' ); ?></h3><!-- /.impression__title -->
						</div><!-- /.impression__title-wrapper -->
						<div class="impression__content content element-extra-small-margin-top">
							<?php the_field( 'impression_content' ); ?>
						</div><!-- /.impression__content content element-extra-small-margin-top -->
					</div><!-- /.impression element-margin-top d-md-none -->

				</div><!-- /.col-md-6 -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.features element-paddings element-margin-top -->

	<section id="get-in-touch" class="get-in-touch text-center element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-md-9 clo-lg-8 col-xl-7 mx-auto">
					<h2 class="get-in-touch__title"><?php the_field( 'get_in_touch_title' ); ?></h2><!-- /.get-in-touch__title -->
					<div class="get-in-touch__content content element-small-margin-top">
						<?php the_field( 'get_in_touch_content' ); ?>
					</div><!-- /.get-in-touch__content content element-small-margin-top -->
					<div class="get-in-touch__form element-small-margin-top">
						<?php echo do_shortcode( '[gravityform id="1" title="false" description="false" ajax="true"]' ); ?>
					</div><!-- /.get-in-touch__form element-small-margin-top -->
				</div><!-- /.col-md-9 clo-lg-8 col-xl-7 mx-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.get-in-touch text-center element-paddings -->

	<section class="cta text-center element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-12">
					<h2 class="cta__title"><?php the_field( 'cta_title' ); ?></h2><!-- /.cta__title -->
					<span class="cta__subtitle d-block"><?php the_field( 'cta_subtitle' ); ?></span>
					<a href="tel:<?php echo filter_var( get_field( 'cta_phone' ), FILTER_SANITIZE_NUMBER_INT); ?>" class="cta__button"><?php the_field( 'cta_phone' ); ?></a>
				</div><!-- /.col-12 -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.cta text-center element-paddings -->

</main><!-- /#main.homepage-template -->

<?php get_footer(); ?>